variable "project_id" {
  type        = string
  description = "GCP project id that owns the secrets and state."
}

variable "region" {
  type        = string
  description = "Default region for the provider."
  default     = "asia-southeast1"
}
