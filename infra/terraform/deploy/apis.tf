locals {
  deploy_apis = [
    "compute.googleapis.com",
    "secretmanager.googleapis.com",
    "iap.googleapis.com",
    "iam.googleapis.com",
    # cloudresourcemanager was actually disabled in the live project and broke
    # IAP/project IAM reads - enable it explicitly.
    "cloudresourcemanager.googleapis.com",
  ]
}

resource "google_project_service" "deploy" {
  for_each = toset(local.deploy_apis)
  service  = each.key
  # Never disable an API on teardown - other resources in the org may depend on it.
  disable_on_destroy = false
}
