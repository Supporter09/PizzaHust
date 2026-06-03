locals {
  # App secrets generated and owned by this (persistent) stack. Names are the
  # contract the deploy stack and the VM startup script read by.
  generated_secrets = [
    "session-secret",
    "delivery-webhook-secret",
    "mysql-root-password",
    "mysql-app-password",
    "admin-seed-password",
    "kitchen-seed-password",
  ]
}

resource "random_password" "app" {
  for_each = toset(local.generated_secrets)
  length   = 32
  # No special chars: these values are embedded in a DATABASE_URL and a shell
  # heredoc on the VM; '@', ':', '/' would corrupt the URL or require escaping.
  special = false
}

resource "google_secret_manager_secret" "app" {
  for_each  = toset(local.generated_secrets)
  secret_id = each.key
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "app" {
  for_each    = google_secret_manager_secret.app
  secret      = each.value.id
  secret_data = random_password.app[each.key].result
}
