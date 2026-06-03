# PizzaHUST GCP - Terraform usage

Step-by-step for the two stacks. For what they are and the public-repo safety
model, see [README.md](README.md).

- `bootstrap/` - persistent: generated app secrets + the reserved global LB IP.
- `deploy/` - the compute/VM/LB/IAP; data-sources `bootstrap` by name.

## One-time manual prerequisites (no Terraform - no API exists)

1. **State bucket.** Holds **plaintext sensitive values** (generated secrets in
   `bootstrap` state; the IAP client secret in `deploy` state) - its access
   restriction is the only thing keeping them private, so keep it locked down.
   ```bash
   PROJECT_ID="$(gcloud config get-value project)"
   gcloud storage buckets create "gs://${PROJECT_ID}-tfstate" \
     --location=asia-southeast1 --uniform-bucket-level-access --public-access-prevention
   gcloud storage buckets update "gs://${PROJECT_ID}-tfstate" --versioning
   ```

2. **OAuth consent screen** (Console -> APIs & Services -> OAuth consent screen):
   Audience **External**; add each approved Google account as a **Test user** (or
   publish to Production to drop the test-user requirement). Required because the
   accounts are `@gmail.com` (external) - the Google-managed IAP client only
   authorizes org-internal users.

3. **OAuth client** (Console -> Credentials -> OAuth client ID -> Web application):
   redirect URI `https://iap.googleapis.com/v1/oauth/clientIds/CLIENT_ID:handleRedirect`.
   Store its id/secret as Secret Manager secrets - Terraform only **data-sources**
   these, never creates or echoes them:
   ```bash
   printf '%s' "<CLIENT_ID>"     | gcloud secrets create iap-oauth-client-id     --data-file=-
   printf '%s' "<CLIENT_SECRET>" | gcloud secrets create iap-oauth-client-secret --data-file=-
   ```

4. **Cloudflare A record** -> the `lb_ip` output (DNS-only / grey cloud). Set once;
   the IP is reserved, so it survives rebuilds. Do this after `bootstrap apply`
   (step below) once `lb_ip` exists.

## Local-only files (gitignored - never commit)

Each stack needs, created by hand:

- `backend.hcl`:
  ```hcl
  bucket = "<project>-tfstate"
  prefix = "bootstrap"   # use "deploy" in the deploy stack
  ```
- `terraform.tfvars` - copy from `terraform.tfvars.example` and fill in real
  values (project id, domain, and the allowlisted IAP principals = PII).

  `deploy/terraform.tfvars` **requires `deploy_ref`** = a full 40-character commit
  SHA (branches and tags are rejected, so an unattended VM reboot can never roll
  production forward outside a `terraform apply`):
  ```hcl
  project_id          = "mk8s-sec-057aa9"
  domain              = "pizzahust.io.vn"
  deploy_ref          = "11ce10d0fb4ad5792a0e14caeace955eadbcc9e4"   # commit the VM deploys
  iap_allowed_members = ["user:someone@gmail.com"]                   # PII - gitignored only
  ```

## Apply order

```bash
cd infra/terraform

# 1. secrets + reserved IP (rare). Import the existing IP first so it is adopted,
#    not recreated:
terraform -chdir=bootstrap init -backend-config=backend.hcl
terraform -chdir=bootstrap import google_compute_global_address.lb pizzahust-lb-ip   # skip if no IP exists yet
terraform -chdir=bootstrap apply

# 2. create the two IAP OAuth secrets (manual, see prerequisite 3)

# 3. infra
terraform -chdir=deploy init -backend-config=backend.hcl
terraform -chdir=deploy apply

# 4. set the Cloudflare A record to the lb_ip output (only once - the IP is persistent)
terraform -chdir=deploy output -raw lb_ip
```

## Importing the existing hand-built resources

The live environment already has these. Either import them, or delete the manual
ones first and let Terraform create fresh. Import preserves the live DNS
target/cert.

The **reserved IP lives in the `bootstrap` stack** (so it survives `deploy`
rebuilds) and is imported there (Apply order step 1). Everything else lives in
`deploy`:

```bash
cd deploy
terraform import google_compute_firewall.allow_lb_hc         pizzahust-allow-lb-hc
terraform import google_compute_instance.vm                  <zone>/pizzahust-vm
terraform import google_compute_health_check.hc              pizzahust-hc
terraform import google_compute_instance_group.ig            <zone>/pizzahust-ig
terraform import google_compute_backend_service.bs           pizzahust-bs
terraform import google_compute_managed_ssl_certificate.cert pizzahust-cert
terraform import google_compute_url_map.um                   pizzahust-um
terraform import google_compute_target_https_proxy.hps       pizzahust-hps
terraform import google_compute_global_forwarding_rule.https pizzahust-fr
terraform import google_compute_url_map.redirect             pizzahust-redirect
terraform import google_compute_target_http_proxy.http       pizzahust-http
terraform import google_compute_global_forwarding_rule.http  pizzahust-fr-http
```

After importing, `terraform plan` should show **no destructive changes** to the
cert or forwarding rules. Reconcile any diffs before applying.

## Day-2 operations

```bash
# Deploy newer code: bump deploy_ref to the new commit SHA, then apply.
# metadata_startup_script is ForceNew, so this RECREATES the VM, which boots,
# builds, migrates, and seeds at that commit.
terraform -chdir=deploy apply -var 'deploy_ref=<new-40-char-sha>'

# Outputs (app url, vm name, lb ip, credential secret names)
terraform -chdir=deploy output

# Read the seeded admin/kitchen login passwords
gcloud secrets versions access latest --secret=admin-seed-password
gcloud secrets versions access latest --secret=kitchen-seed-password
```

### Gotchas

- The VM has **no external IP** - boot needs the org **Cloud NAT** for the git
  clone, docker pulls, and Secret Manager REST calls. If NAT is missing, startup
  fails (logged to `/var/log/pizzahust-startup.log` on the VM).
- A plain VM reboot **re-deploys the same pinned SHA** (no roll-forward). Shipping
  newer code means bumping `deploy_ref` and re-applying.

## Teardown

```bash
terraform -chdir=deploy destroy
```

Removes compute/LB/IAP but leaves `bootstrap` (secrets **and the reserved IP**),
the OAuth client/consent screen, and the state bucket intact - so a re-apply
reproduces the stack with the **same** admin/kitchen credentials **and the same
IP**, so the DNS record never needs changing.
