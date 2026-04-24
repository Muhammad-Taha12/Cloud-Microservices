output "master_public_ip" {
  description = "Public IP of the Kubernetes master node"
  value       = aws_instance.master.public_ip
}

output "worker_public_ips" {
  description = "Public IPs of the worker nodes"
  value       = aws_instance.workers[*].public_ip
}

output "ansible_inventory" {
  description = "Ansible inventory snippet"
  value = <<-EOT
    [master]
    ${aws_instance.master.public_ip} ansible_user=ubuntu

    [workers]
    %{ for w in aws_instance.workers ~}
    ${w.public_ip} ansible_user=ubuntu
    %{ endfor ~}
  EOT
}
