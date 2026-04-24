variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "ami_id" {
  description = "Ubuntu 22.04 LTS AMI ID (region-specific)"
  type        = string
  default     = "ami-0c7217cdde317cfec" # us-east-1 Ubuntu 22.04
}

variable "master_instance_type" {
  description = "Instance type for K8s control plane"
  type        = string
  default     = "t3.medium"
}

variable "worker_instance_type" {
  description = "Instance type for K8s worker nodes"
  type        = string
  default     = "t3.medium"
}

variable "worker_count" {
  description = "Number of worker nodes"
  type        = number
  default     = 2
}

variable "key_name" {
  description = "Name of the EC2 key pair for SSH access"
  type        = string
}
