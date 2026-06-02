"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { ApiClientError } from "@/lib/api/client";

type LoyaltyState = {
  current_points: number;
  total_points_earned: number;
};

export default function AccountPage() {
  const router = useRouter();
  const { user, loading, updateProfile, getLoyalty } = useAuth();

  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [loyalty, setLoyalty] = useState<LoyaltyState | null>(null);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }

    if (!user) {
      return;
    }

    void getLoyalty()
      .then((data) => {
        setLoyalty(data);
        setLoyaltyError(null);
      })
      .catch((error) => {
        if (error instanceof ApiClientError) {
          setLoyaltyError(error.message);
        } else {
          setLoyaltyError("Unable to load loyalty info.");
        }
      });
  }, [loading, user, router, getLoyalty]);

  if (loading || !user) {
    return <p className="text-sm text-slate-500">Loading account...</p>;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormMessage(null);
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("full_name") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();

    try {
      await updateProfile({ full_name: fullName, address });
      setFormMessage("Profile updated.");
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFormError(error.message);
      } else {
        setFormError("Unable to update profile.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="auth-card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Update your profile details below.</p>

        <form
          key={`${user.full_name}-${user.address ?? ""}`}
          onSubmit={onSubmit}
          className="mt-6 space-y-4"
        >
          <label className="block text-sm font-medium text-slate-700">
            Full name
            <input className="input-field mt-1" name="full_name" defaultValue={user.full_name} />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Phone number
            <input className="input-field mt-1 bg-slate-100" value={user.phone_number} disabled />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Address
            <input className="input-field mt-1" name="address" defaultValue={user.address ?? ""} />
          </label>

          {formError ? <p className="text-sm font-medium text-[var(--brand-red)]">{formError}</p> : null}
          {formMessage ? <p className="text-sm font-medium text-emerald-600">{formMessage}</p> : null}

          <button type="submit" disabled={saving} className="btn-primary w-full py-2.5 disabled:opacity-60">
            {saving ? "Saving..." : "Save profile"}
          </button>
        </form>
      </div>

      <aside className="auth-card p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-slate-900">Loyalty</h2>
        {loyaltyError ? (
          <p className="mt-3 text-sm text-[var(--brand-red)]">{loyaltyError}</p>
        ) : loyalty ? (
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Current points</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{loyalty.current_points}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total earned</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{loyalty.total_points_earned}</p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Loading loyalty...</p>
        )}
      </aside>
    </section>
  );
}
