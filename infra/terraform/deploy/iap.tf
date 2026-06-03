# Resource-level grant on the backend service. In this locked-down org, project-
# level IAP grants were NOT honored - the grant must be on the backend service.
resource "google_iap_web_backend_service_iam_member" "members" {
  for_each            = toset(var.iap_allowed_members)
  web_backend_service = google_compute_backend_service.bs.name
  role                = "roles/iap.httpsResourceAccessor"
  member              = each.value
}
