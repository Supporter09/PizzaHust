"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ApiClientError } from "@/lib/api/client";
import {
  getSettings,
  getWardFees,
  putSettings,
  type SettingsOut,
  type WardFeesOut,
} from "@/lib/api/admin-settings";
import { WardFeesEditor } from "@/components/admin/ward-fees-editor";
import Breadcrumb from "@/components/admin/Breadcrumb";

const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : String(e));

// Number inputs are kept as strings so they stay controlled while editing;
// converted with Number(...) on submit (mirrors basics-editor's price handling).
type LoyaltyForm = { accrual: string; redeem: string; maxPct: string };

const TIMEZONES =
  typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];

function ChevronDown() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function SettingsPage() {
  const [timezone, setTimezone] = useState("");
  const [loyalty, setLoyalty] = useState<LoyaltyForm>({ accrual: "", redeem: "", maxPct: "" });
  const [wardFees, setWardFees] = useState<WardFeesOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const applySettings = (s: SettingsOut) => {
    setTimezone(s.timezone);
    setLoyalty({
      accrual: String(s.loyalty_accrual_rate),
      redeem: String(s.loyalty_redeem_value_vnd),
      maxPct: String(s.loyalty_max_redeem_pct),
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [settings, fees] = await Promise.all([getSettings(), getWardFees()]);
      applySettings(settings);
      setWardFees(fees);
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function saveSettings() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const updated = await putSettings({
        timezone,
        loyalty_accrual_rate: Number(loyalty.accrual),
        loyalty_redeem_value_vnd: Number(loyalty.redeem),
        loyalty_max_redeem_pct: Number(loyalty.maxPct),
      });
      applySettings(updated);
      setSaved(true);
      toast.success("Settings saved");
    } catch (e) {
      setError(msg(e));
      toast.error(msg(e));
    } finally {
      setBusy(false);
    }
  }

  // Ensure the current tz is selectable even if the runtime list omits it.
  const tzOptions = timezone && !TIMEZONES.includes(timezone) ? [timezone, ...TIMEZONES] : TIMEZONES;

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Settings" }]} />
      <h1 className="mb-6 text-2xl font-semibold text-fg">Settings</h1>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {!loading && error && !wardFees && (
        <div className="mb-4 rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          {error}
        </div>
      )}

      {!loading && wardFees && (
        <>
          <section className="mb-6 rounded-xl border border-line bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-fg">General &amp; loyalty</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <label htmlFor="tz" className="mb-1 block text-xs font-medium text-muted">
                  Timezone
                </label>
                <div className="relative">
                  <select
                    id="tz"
                    value={timezone}
                    onChange={(e) => {
                      setTimezone(e.target.value);
                      setSaved(false);
                    }}
                    className="w-full appearance-none rounded-lg border border-line px-3 py-2 pr-9 text-sm leading-5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  >
                    {tzOptions.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                  <ChevronDown />
                </div>
              </div>
              <div>
                <label htmlFor="accrual" className="mb-1 block text-xs font-medium text-muted">
                  Loyalty accrual rate
                </label>
                <input
                  id="accrual"
                  type="number"
                  min={1}
                  step={1}
                  value={loyalty.accrual}
                  onChange={(e) => {
                    setLoyalty((p) => ({ ...p, accrual: e.target.value }));
                    setSaved(false);
                  }}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
              </div>
              <div>
                <label htmlFor="redeem" className="mb-1 block text-xs font-medium text-muted">
                  Redeem value (VND per point)
                </label>
                <input
                  id="redeem"
                  type="number"
                  min={1}
                  value={loyalty.redeem}
                  onChange={(e) => {
                    setLoyalty((p) => ({ ...p, redeem: e.target.value }));
                    setSaved(false);
                  }}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
              </div>
              <div>
                <label htmlFor="maxPct" className="mb-1 block text-xs font-medium text-muted">
                  Max redeem percent
                </label>
                <input
                  id="maxPct"
                  type="number"
                  min={0.01}
                  max={1}
                  step={0.05}
                  value={loyalty.maxPct}
                  onChange={(e) => {
                    setLoyalty((p) => ({ ...p, maxPct: e.target.value }));
                    setSaved(false);
                  }}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
                <p className="mt-1 text-xs text-muted">Fraction 0–1 (e.g. 0.5 = 50%).</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={saveSettings}
                disabled={busy}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover disabled:opacity-50"
              >
                Save settings
              </button>
              {saved && !error && <span className="text-sm text-muted">Saved</span>}
              {error && <span className="text-sm text-danger">{error}</span>}
            </div>
          </section>

          <WardFeesEditor initial={wardFees} />
        </>
      )}
    </div>
  );
}
