resource "google_compute_instance" "vm" {
  name         = "pizzahust-vm"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["pizzahust-lb"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 30
    }
  }

  network_interface {
    subnetwork = data.google_compute_subnetwork.poc.id
    # No access_config block => no external IP (egress via the org Cloud NAT).
  }

  service_account {
    email = google_service_account.vm.email
    # cloud-platform scope is required for the metadata-server token to call
    # Secret Manager; the IAM role alone is insufficient under restrictive scopes.
    scopes = ["cloud-platform"]
  }

  # metadata_startup_script (not a metadata map key) is ForceNew: editing the
  # rendered template recreates the VM so the new boot logic actually runs. A
  # metadata-map startup-script updates in place and would never re-execute.
  metadata_startup_script = templatefile("${path.module}/templates/startup.sh.tftpl", {
    repo_url   = var.repo_url
    domain     = var.domain
    project_id = var.project_id
    deploy_ref = var.deploy_ref
  })

  allow_stopping_for_update = true

  depends_on = [
    google_project_service.deploy,
    google_secret_manager_secret_iam_member.vm_access,
  ]
}
