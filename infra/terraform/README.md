# PizzaHUST GCP - Terraform

Two stacks codify the live deployment (VM + Docker Compose behind an external HTTPS
LB with IAP). State lives in a private GCS bucket; secrets live in Secret Manager.

## Layout

- `bootstrap/` - long-lived generated secrets (apply once, rarely destroy).
- `deploy/` - ephemeral compute/LB/IAP; data-sources the secrets. Safe to destroy/apply.

## One-time manual prerequisites (no Terraform - no API exists)

1. **State bucket** (Task 2):
   ```bash
   PROJECT_ID="$(gcloud config get-value project)"
   gcloud storage buckets create "gs://${PROJECT_ID}-tfstate" \
     --location=asia-southeast1 --uniform-bucket-level-access --public-access-prevention
   gcloud storage buckets update "gs://${PROJECT_ID}-tfstate" --versioning
   ```
   The bucket holds **plaintext sensitive values** (generated secrets in `bootstrap`
   state; the IAP client secret in `deploy` state). Its access restriction is the
   only thing keeping them private - keep it locked down.

2. **OAuth consent screen** (Console -> APIs & Services -> OAuth consent screen):
   Audience **External**; add each approved Google account as a **Test user** (or
   publish to Production to drop the test-user requirement). Required because the
   accounts are `@gmail.com` (external) - the Google-managed IAP client only
   authorizes org-internal users.

3. **OAuth client** (Console -> Credentials -> OAuth client ID -> Web application):
   redirect URI `https://iap.googleapis.com/v1/oauth/clientIds/CLIENT_ID:handleRedirect`.
   Store its id/secret as Secret Manager secrets (Task 4 step 4):
   ```bash
   printf '%s' "<CLIENT_ID>"     | gcloud secrets create iap-oauth-client-id     --data-file=-
   printf '%s' "<CLIENT_SECRET>" | gcloud secrets create iap-oauth-client-secret --data-file=-
   ```
   Terraform only **data-sources** these - never creates or echoes them.

4. **Cloudflare A record** -> the `lb_ip` output (DNS-only / grey cloud). The IP is
   reserved, so set once; it survives rebuilds.

## Local-only files (gitignored - never commit)

Each stack needs, created by hand:

- `backend.hcl`:
  ```hcl
  bucket = "<project>-tfstate"
  prefix = "bootstrap"   # or "deploy"
  ```
- `terraform.tfvars` - copy from `terraform.tfvars.example` and fill in real values
  (project id, domain, and the allowlisted principals = PII).

## Apply order

```bash
# 1. secrets + reserved IP (rare). Import the existing IP first so it is adopted, not recreated:
terraform -chdir=bootstrap init -backend-config=backend.hcl
terraform -chdir=bootstrap import google_compute_global_address.lb pizzahust-lb-ip   # skip if no IP exists yet
terraform -chdir=bootstrap apply
# 2. create the two IAP OAuth secrets (manual, see prereq 3)
# 3. infra
terraform -chdir=deploy init -backend-config=backend.hcl
terraform -chdir=deploy apply
# 4. set the Cloudflare A record to the lb_ip output (only once - the IP is persistent)
```

## Importing the existing hand-built resources

The live environment already has these. Either import them, or delete the manual ones
first and let Terraform create fresh. Import preserves the live DNS target/cert.

The **reserved IP lives in the `bootstrap` stack** (so it survives `deploy` rebuilds) and is
imported there (see Apply order step 1). Everything else lives in `deploy`:

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

After importing, `terraform plan` should show **no destructive changes** to the cert or
forwarding rules. Reconcile any diffs before applying.

## Teardown

`terraform -chdir=deploy destroy` removes compute/LB/IAP but leaves `bootstrap` (secrets
**and the reserved IP**), the OAuth client/consent screen, and the state bucket intact - so
a re-apply reproduces the stack with the **same** admin/kitchen credentials **and the same
IP**, so the DNS record never needs changing.
