terraform {
  required_version = ">= 1.3.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC
resource "aws_vpc" "eventsphere" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name    = "eventsphere-vpc"
    Project = "eventsphere"
  }
}

resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.eventsphere.id
  cidr_block        = cidrsubnet("10.0.0.0/16", 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name    = "eventsphere-public-${count.index}"
    Project = "eventsphere"
  }
}

data "aws_availability_zones" "available" {}

resource "aws_internet_gateway" "eventsphere" {
  vpc_id = aws_vpc.eventsphere.id
  tags   = { Name = "eventsphere-igw" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.eventsphere.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.eventsphere.id
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Security Group for K8s control plane
resource "aws_security_group" "k8s_master" {
  name_prefix = "eventsphere-master-"
  vpc_id      = aws_vpc.eventsphere.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH"
  }
  ingress {
    from_port   = 6443
    to_port     = 6443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Kubernetes API"
  }
  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
    description = "Intra-cluster"
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# EC2 – control plane
resource "aws_instance" "master" {
  ami                         = var.ami_id
  instance_type               = var.master_instance_type
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.k8s_master.id]
  key_name                    = var.key_name
  associate_public_ip_address = true

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  tags = {
    Name    = "eventsphere-master"
    Role    = "master"
    Project = "eventsphere"
  }
}

# EC2 – worker nodes
resource "aws_instance" "workers" {
  count                       = var.worker_count
  ami                         = var.ami_id
  instance_type               = var.worker_instance_type
  subnet_id                   = aws_subnet.public[count.index % 2].id
  vpc_security_group_ids      = [aws_security_group.k8s_master.id]
  key_name                    = var.key_name
  associate_public_ip_address = true

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  tags = {
    Name    = "eventsphere-worker-${count.index}"
    Role    = "worker"
    Project = "eventsphere"
  }
}
