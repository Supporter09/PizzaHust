variable "project_id" {
  type        = string
  description = "GCP project id."
}

variable "region" {
  type    = string
  default = "asia-southeast1"
}

variable "zone" {
  type    = string
  default = "asia-southeast1-a"
}

variable "domain" {
  type        = string
  description = "Public hostname served behind the LB/IAP (e.g. pizzahust.io.vn)."
}

variable "repo_url" {
  type        = string
  description = "Public git URL the VM clones the app from."
  default     = "https://github.com/Supporter09/PizzaHust.git"
}

variable "deploy_ref" {
  type        = string
  description = "Immutable commit SHA the VM checks out and deploys. Bumping it recreates the VM, which boots, builds, migrates, and seeds at that commit. Must be a full SHA (not a branch/tag) so a reboot can never roll production forward outside a terraform apply."

  # Full SHA only: a branch or movable tag would let an unattended reboot redeploy.
  validation {
    condition     = can(regex("^[0-9a-f]{40}$", var.deploy_ref))
    error_message = "deploy_ref must be a full 40-character commit SHA. Branches and tags can move, which would let a VM reboot roll production forward outside terraform apply."
  }
}

variable "machine_type" {
  type    = string
  default = "e2-medium"
}

variable "network_name" {
  type        = string
  description = "Existing org-managed VPC network name."
  default     = "mk8s-poc-net"
}

variable "subnet_name" {
  type        = string
  description = "Existing org-managed subnet name (in var.region)."
  default     = "mk8s-poc-subnet"
}

variable "iap_allowed_members" {
  type        = list(string)
  description = "Full IAM principals granted roles/iap.httpsResourceAccessor (e.g. user:alice@example.com)."

  # Non-empty: an empty list creates zero IAP bindings, locking everyone out.
  validation {
    condition = length(var.iap_allowed_members) > 0 && alltrue([
      for m in var.iap_allowed_members :
      can(regex("^(user|group|serviceAccount):", m))
    ])
    error_message = "Provide at least one full IAM principal: user:, group:, or serviceAccount:."
  }
}
