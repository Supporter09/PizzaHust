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
  description = "Public git URL the VM clones origin/main from."
  default     = "https://github.com/Supporter09/PizzaHust.git"
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

  validation {
    condition = alltrue([
      for m in var.iap_allowed_members :
      can(regex("^(user|group|serviceAccount):", m))
    ])
    error_message = "Each entry must be a full IAM principal: user:, group:, or serviceAccount:."
  }
}
