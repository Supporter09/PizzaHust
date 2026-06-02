resource "google_compute_health_check" "hc" {
  name = "pizzahust-hc"
  http_health_check {
    port         = 80
    request_path = "/healthz"
  }
}

resource "google_compute_instance_group" "ig" {
  name      = "pizzahust-ig"
  zone      = var.zone
  instances = [google_compute_instance.vm.self_link]

  named_port {
    name = "http"
    port = 80
  }
}

resource "google_compute_backend_service" "bs" {
  name                  = "pizzahust-bs"
  load_balancing_scheme = "EXTERNAL"
  protocol              = "HTTP"
  port_name             = "http"
  timeout_sec           = 30
  health_checks         = [google_compute_health_check.hc.id]

  backend {
    group = google_compute_instance_group.ig.id
  }

  iap {
    enabled              = true
    oauth2_client_id     = data.google_secret_manager_secret_version.iap_client_id.secret_data
    oauth2_client_secret = data.google_secret_manager_secret_version.iap_client_secret.secret_data
  }
}

resource "google_compute_managed_ssl_certificate" "cert" {
  name = "pizzahust-cert"
  managed {
    domains = [var.domain]
  }
}

resource "google_compute_url_map" "um" {
  name            = "pizzahust-um"
  default_service = google_compute_backend_service.bs.id
}

resource "google_compute_target_https_proxy" "hps" {
  name             = "pizzahust-hps"
  url_map          = google_compute_url_map.um.id
  ssl_certificates = [google_compute_managed_ssl_certificate.cert.id]
}

resource "google_compute_global_forwarding_rule" "https" {
  name                  = "pizzahust-fr"
  load_balancing_scheme = "EXTERNAL"
  target                = google_compute_target_https_proxy.hps.id
  ip_address            = data.google_compute_global_address.lb.id
  port_range            = "443"
}

# HTTP :80 -> HTTPS 301 redirect (same static IP).
resource "google_compute_url_map" "redirect" {
  name = "pizzahust-redirect"
  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "http" {
  name    = "pizzahust-http"
  url_map = google_compute_url_map.redirect.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "pizzahust-fr-http"
  load_balancing_scheme = "EXTERNAL"
  target                = google_compute_target_http_proxy.http.id
  ip_address            = data.google_compute_global_address.lb.id
  port_range            = "80"
}
