output "app_secret_names" {
  description = "Secret Manager secret ids the deploy stack / VM read by name."
  value       = [for s in google_secret_manager_secret.app : s.secret_id]
}

output "lb_ip_name" {
  description = "Name of the reserved global address the deploy stack data-sources."
  value       = google_compute_global_address.lb.name
}

output "lb_ip" {
  description = "Reserved global IP - point the Cloudflare A record for the domain here."
  value       = google_compute_global_address.lb.address
}
