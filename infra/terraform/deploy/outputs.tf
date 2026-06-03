output "lb_ip" {
  description = "Reserved global IP (owned by bootstrap) - point the Cloudflare A record for var.domain here."
  value       = data.google_compute_global_address.lb.address
}

output "vm_name" {
  value = google_compute_instance.vm.name
}

output "app_url" {
  value = "https://${var.domain}"
}

output "credential_secret_names" {
  description = "Read login passwords with: gcloud secrets versions access latest --secret=<name>"
  value = {
    admin   = "admin-seed-password"
    kitchen = "kitchen-seed-password"
  }
}
