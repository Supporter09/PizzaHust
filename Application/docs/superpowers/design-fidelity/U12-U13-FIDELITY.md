# U12 + U13 — Account dashboard, Edit Profile, Loyalty Points

**Mockups:** `Design/account.html`, `Design/edit-profile.html`, `Design/loyalty.html`  
**App routes:** `/account`, `/account/edit`, `/account/loyalty`  
**Compared:** 2026-06-15 — mockup HTML + implementation (`app/account/*`); Playwright full-page captures attempted at 1440×1000 and 390×844 (light/dark) against `http://127.0.0.1:3000` with seeded customer `0901234567` / `demo1234` (login navigation timed out in standalone capture script; structural review + vitest/e2e coverage used as primary evidence).

## Screenshots (local only, not committed)

| Pattern | Description |
|---------|-------------|
| `u12-u13-app-account-{1440,390}-{light,dark}.png` | Dashboard |
| `u12-u13-app-edit-{…}.png` | Edit profile |
| `u12-u13-app-loyalty-{…}.png` | Loyalty |

Regenerate: logged-in Playwright session → each route → `fullPage: true` into this directory (same approach as U11).

---

## `/account` — `account.html`

| Region | Mockup | App | Classification |
|--------|--------|-----|----------------|
| Chrome | `mountNav` / footer | Shared customer shell + theme toggle | **Accepted** |
| Title | `h1` “My Account” | Same | **Must-match** |
| Grid | `1fr` + 360px quick column | `lg:grid-cols-[1fr_360px]` | **Must-match** |
| Profile card | Avatar, name, role, Edit Profile outline | `Avatar`, name, “Pizza Lover”, `/account/edit` link | **Must-match** (role line simplified) |
| Member since | “Member since Aug 2025” | Omitted | **Accepted** — `AuthUserDTO` has no `created_at` on session user |
| Contact | Mail / phone / pin icons + 3 rows | Plain text rows; **email only if present** | **Must-match** + **deliberate deviation** (conditional email) |
| Stats | Two minicards with bag/award icons | Two `auth-card` stat tiles, no icons | **Accepted** — hierarchy preserved |
| Quick actions | `quick-link` + arrows + Order Now primary | `quick-link` CSS + Order Now `btn-primary` | **Must-match** |
| Data | USD-ish illustrative counts | API order count (≤50) + `getLoyaltyMe` points | **Accepted** — server-authoritative |

**Remaining must-match gaps:** None requiring code change for this pass.

---

## `/account/edit` — `edit-profile.html`

| Region | Mockup | App | Classification |
|--------|--------|-----|----------------|
| Back + title | Back to Account, Edit Profile | Link + `h1` | **Must-match** |
| Width | `max-width: 620px` | `max-w-[620px]` | **Must-match** |
| Avatar row | Upload + Remove + JPG/PNG hint | Upload/Remove + PNG/JPEG/WebP hint | **Must-match** (WebP = product) |
| Fields | Name, disabled phone + support copy, address | Same | **Must-match** |
| Password | Section + current/new, footer Save on one form | Separate profile save + **Update password** form | **Accepted** — dedicated `POST /api/auth/me/password`, clearer errors |
| Footer | Cancel + Save Changes | Cancel + Save Changes on profile form | **Must-match** |

**Remaining must-match gaps:** None.

---

## `/account/loyalty` — `loyalty.html`

| Region | Mockup | App | Classification |
|--------|--------|-----|----------------|
| Back + title | Present | Present | **Must-match** |
| Width | 860px | `max-w-[860px]` | **Must-match** |
| Balance hero | Gradient, medal, points, savings pill | Gradient `from-brand`, points, **VND** savings pill | **Must-match** + **deliberate deviation** (VND not `$`) |
| How it works | 3 columns incl. **Special Bonuses / birthdays** | 2 columns from `/api/config/loyalty` (earn + redeem) | **Deliberate deviation** — dropped birthday bonus card (no MVP rule) |
| History | Earn + redeem + birthday rows | Earn-only rows from `GET /api/loyalty/me/history` | **Accepted** — redeem negatives arrive with **U14** |
| Money copy | `$1` / `$10` illustrative | `vnd()` + config rates | **Accepted** — config-driven |

**Optional polish (not fixed this pass):** mockup medal ornament on balance card; cream-tinted “how” panel vs `bg-surface` — cosmetic only.

**Remaining must-match gaps:** None.

---

## Deliberate deviations (summary)

1. **VND not `$`** on loyalty balance and how-it-works copy (`redeemable_value_vnd`, `LoyaltyConfigOut`).
2. **Dropped “Special Bonuses / Birthday bonus”** third column in how-it-works (and no birthday history rows).
3. **Email contact row** on dashboard only when the user record includes email (seed customer may show phone + address only).
4. **Session-kept password change** — separate submit control, not bundled into profile Save.

## Dark / mobile

Theme uses `dark` class on `<html>` (not mockup hex). Layout collapses to single column below `lg` for dashboard; edit/loyalty remain narrow-column — structure survives at 390px width per existing responsive classes.

## Verification hooks

- Vitest: `app/account/page.test.tsx`, `edit/page.test.tsx`, `loyalty/page.test.tsx`
- E2E: `tests/e2e/account-profile-loyalty.spec.ts`