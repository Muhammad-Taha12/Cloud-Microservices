# EventSphere — Microservices Deployment

A microservices-based Event Booking System deployed using Docker, Terraform, Ansible, Kubernetes, and ArgoCD.

## Services

| Service | Port |
|---|---|
| Users Backend | 5000 |
| Events Backend | 5001 |
| Booking Backend | 5002 |
| Notifications Backend | 5003 |
| Frontend | 80 |
| PostgreSQL | 5432 |
| RabbitMQ | 5672 |

---

## Local Deployment (WSL2)

### 1. Prerequisites
- Windows with WSL2 (Ubuntu 22.04)
- systemd enabled in `/etc/wsl.conf` (`[boot] systemd=true`)
- Docker Desktop installed

### 2. Run Ansible (installs Docker, MicroK8s, ArgoCD)
```bash
sudo apt install ansible -y
ansible-playbook -i ansible/inventory.ini ansible/site.yml
```

`inventory.ini` should target localhost:
```ini
[master]
localhost ansible_connection=local

[all:vars]
ansible_python_interpreter=/usr/bin/python3
```

### 3. Verify MicroK8s
```bash
microk8s status --wait-ready
microk8s kubectl get nodes
```

### 4. Build & Push Docker Images
```bash
# Trust local registry
sudo mkdir -p /var/snap/microk8s/current/args/certs.d/localhost:32000
sudo bash -c 'cat > /var/snap/microk8s/current/args/certs.d/localhost:32000/hosts.toml << EOF
server = "http://localhost:32000"

[host."http://localhost:32000"]
  capabilities = ["pull", "resolve"]
EOF'
microk8s stop && microk8s start && microk8s status --wait-ready

# Build alpine images
docker build -t localhost:32000/users:latest ./Users/backend/
docker build -t localhost:32000/events:latest ./Events/backend/
docker build -t localhost:32000/booking:latest ./Booking/backend/
docker build -t localhost:32000/notifications:latest ./Notifications/backend/
docker build -t localhost:32000/frontend:latest ./frontend/

# Push to MicroK8s registry
docker push localhost:32000/users:latest
docker push localhost:32000/events:latest
docker push localhost:32000/booking:latest
docker push localhost:32000/notifications:latest
docker push localhost:32000/frontend:latest

# Verify
curl http://localhost:32000/v2/_catalog
```

### 5. Deploy to Kubernetes
```bash
microk8s kubectl apply -f k8s/
microk8s kubectl get pods -n onlineeventbooking -w
```

### 6. Access ArgoCD UI
```bash
# Get admin password
microk8s kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d && echo

# Port-forward
microk8s kubectl port-forward svc/argocd-server -n argocd 8080:443
```
Open **https://localhost:8080** — login with `admin` and the password above.

### 7. Apply ArgoCD App Config
```bash
microk8s kubectl apply -f .argocd/application.yaml
```

---

## AWS Deployment

### 1. Configure AWS Credentials
```bash
aws configure
aws sts get-caller-identity   # verify
```

### 2. Provision Infrastructure (Terraform)
```bash
cd terraform/
terraform init
terraform plan -var="key_name=eventsphere"
terraform apply -var="key_name=eventsphere"
# Note the output IPs for the next step
```

### 3. Update Ansible Inventory
Replace IPs in `ansible/inventory.ini` with Terraform output:
```ini
[master]
<master_public_ip> ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/eventsphere.pem

[workers]
<worker1_public_ip> ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/eventsphere.pem
<worker2_public_ip> ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/eventsphere.pem

[all:vars]
ansible_python_interpreter=/usr/bin/python3
```

### 4. Run Ansible on EC2
```bash
chmod 400 ~/.ssh/eventsphere.pem
ansible-playbook -i ansible/inventory.ini ansible/site.yml
```

### 5. Copy Manifests & Deploy
```bash
scp -i ~/.ssh/eventsphere.pem -r k8s/ ubuntu@<master_public_ip>:~/
scp -i ~/.ssh/eventsphere.pem -r .argocd/ ubuntu@<master_public_ip>:~/

ssh -i ~/.ssh/eventsphere.pem ubuntu@<master_public_ip>
microk8s kubectl apply -f k8s/
microk8s kubectl get pods -n onlineeventbooking -w
```

### 6. Access ArgoCD UI (via SSH tunnel)
```bash
# Run from your local machine
ssh -i ~/.ssh/eventsphere.pem -L 8080:localhost:8080 ubuntu@<master_public_ip> \
  "microk8s kubectl port-forward svc/argocd-server -n argocd 8080:443"
```
Open **https://localhost:8080** in your browser.

### 7. Destroy When Done
```bash
cd terraform/
terraform destroy -var="key_name=eventsphere"
```
> ⚠️ Always destroy after your demo to avoid AWS charges.

---

## CI/CD Pipeline (GitHub Actions + ArgoCD)

On every push to `master`:
1. GitHub Actions builds Docker images and pushes them to `ghcr.io`
2. The workflow updates image tags in the k8s manifests and commits back
3. ArgoCD detects the manifest change and syncs the cluster automatically

### Requirements
- Repo → **Settings → Actions → General → Workflow permissions → Read and write**
- Repo → **Settings → Packages** → ensure GitHub Container Registry is enabled

### Trigger manually
```bash
git add .
git commit -m "trigger pipeline"
git push origin master
# Monitor at: https://github.com/<username>/<repo>/actions
```

---

## Useful Commands

```bash
# All pods status
microk8s kubectl get pods -n onlineeventbooking

# Logs for a service
microk8s kubectl logs deployment/user-service-deployment -n onlineeventbooking

# All services and ports
microk8s kubectl get svc -n onlineeventbooking

# ArgoCD app sync status
microk8s kubectl get application -n argocd

# Verify images in registry
curl http://localhost:32000/v2/_catalog

# Clean up Docker
docker system prune -f
```
