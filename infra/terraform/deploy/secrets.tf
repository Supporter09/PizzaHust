locals {
  # Must match bootstrap/secrets.tf local.generated_secrets exactly. The VM reads
  # these by name at boot; Terraform here reads only their metadata (not values).
  app_secret_names = [
    "session-secret",
    "delivery-webhook-secret",
    "mysql-root-password",
    "mysql-app-password",
    "admin-seed-password",
    "kitchen-seed-password",
  ]
}

# App secrets: metadata only. Values never enter deploy state - the VM fetches
# them at boot via the metadata-server token + Secret Manager REST API.
data "google_secret_manager_secret" "app" {
  for_each  = toset(local.app_secret_names)
  secret_id = each.key
}

# IAP OAuth client material: Terraform itself must pass these literal values into
# the backend service's iap block, so (only) these values land in deploy state.
data "google_secret_manager_secret_version" "iap_client_id" {
  secret = "iap-oauth-client-id"
}

data "google_secret_manager_secret_version" "iap_client_secret" {
  secret = "iap-oauth-client-secret"
}

# Dedicated VM identity - least privilege.
resource "google_service_account" "vm" {
  account_id   = "pizzahust-vm"
  display_name = "PizzaHUST VM (Secret Manager reader)"
}

# Grant the VM SA read access to exactly the six app secrets (not the IAP ones).
resource "google_secret_manager_secret_iam_member" "vm_access" {
  for_each  = data.google_secret_manager_secret.app
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.vm.email}"
}
