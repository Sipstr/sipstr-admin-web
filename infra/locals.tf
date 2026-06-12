locals {
  fqdn = "${var.subdomain}.${var.domain_name}"

  bucket_name = "${var.project_name}-${var.env}-${replace(var.domain_name, ".", "-")}"

  tags = {
    Project = var.project_name
    Stack   = "frontend"
  }
}
