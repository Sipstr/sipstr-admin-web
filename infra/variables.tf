variable "project_name" {
  type        = string
  description = "Project name prefix for resources"
  default     = "sipstr-admin"
}

variable "env" {
  type        = string
  description = "Project name prefix for resources"
  default     = "sandbox"
}

variable "aws_region" {
  type        = string
  description = "Primary AWS region"
  default     = "us-east-1"
}

variable "domain_name" {
  type        = string
  description = "Root domain"
  default     = "sipstr.com"
}

variable "subdomain" {
  type        = string
  description = "Subdomain for the site"
  default     = "admin.sandbox"
}
