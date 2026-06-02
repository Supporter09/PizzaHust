# Org-managed, locked-down network/subnet - read only, never mutate.
data "google_compute_network" "poc" {
  name = var.network_name
}

data "google_compute_subnetwork" "poc" {
  name   = var.subnet_name
  region = var.region
}

# Reserved global IP - OWNED BY THE bootstrap STACK so it survives deploy rebuilds.
# Read it here by name; never create or mutate it in this stack.
data "google_compute_global_address" "lb" {
  name = "pizzahust-lb-ip"
}

# The only firewall rule we add: GFE health-check + proxy ranges -> VM :80.
resource "google_compute_firewall" "allow_lb_hc" {
  name      = "pizzahust-allow-lb-hc"
  network   = data.google_compute_network.poc.id
  direction = "INGRESS"

  source_ranges = ["130.211.0.0/22", "35.191.0.0/16"]
  target_tags   = ["pizzahust-lb"]

  allow {
    protocol = "tcp"
    ports    = ["80"]
  }
}
