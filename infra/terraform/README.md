# PizzaHUST GCP - Terraform

Two stacks codify the live deployment - a single VM running the Docker Compose
stack behind a global external HTTPS Load Balancer with IAP. State lives in a
private GCS bucket; secrets live in Secret Manager.

- `bootstrap/` - persistent: generated app secrets **and the reserved global LB
  IP**. Apply once, rarely destroy.
- `deploy/` - the ephemeral compute/LB/IAP. **Data-sources** the secrets and the
  IP from `bootstrap` by name, so a `destroy`+`apply` of `deploy` keeps the
  **same credentials and the same IP** (the DNS A record, set once, survives).

## Public-repo safety

This repo is public; nothing sensitive is committed, by construction:

- Per-stack `.gitignore` excludes `*.tfstate*`, `*.tfvars`, `backend.hcl`,
  `.terraform/`, and any credentials JSON.
- Allowlisted IAP members (PII) and the project id live only in the gitignored
  `terraform.tfvars`; a committed `terraform.tfvars.example` documents them with
  placeholders.
- App-secret **values** never enter `deploy` state - `deploy` data-sources only
  their **names**; the VM fetches values at boot from Secret Manager. Only the
  IAP OAuth client secret is read by Terraform itself.

## Usage

Prerequisites, local files, apply order, resource imports, and day-2 ops:
**[USAGE.md](USAGE.md)**.
