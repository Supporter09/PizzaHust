# Reserved global IP the DNS A record points at. It lives here (not in deploy) so a
# `deploy destroy`/`apply` cycle never releases it and the DNS record (set once) survives.
resource "google_compute_global_address" "lb" {
  name       = "pizzahust-lb-ip"
  depends_on = [google_project_service.compute]
}
