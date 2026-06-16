"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/avatar";
import { useAuth } from "@/components/auth-provider";
import { ApiClientError } from "@/lib/api/client";

export default function EditProfilePage() {
  const router = useRouter();
  const { user, loading, updateProfile, uploadAvatar, removeAvatar, changePassword } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading) return <p className="text-sm text-muted">Loading…</p>;
  if (!user) return null;

  const onSaveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await updateProfile({
        full_name: String(fd.get("full_name") ?? "").trim(),
        address: String(fd.get("address") ?? "").trim(),
      });
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Unable to update profile.");
    }
  };

  const onPickAvatar = async (file: File | undefined) => {
    if (!file) return;
    try {
      await uploadAvatar(file);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Unable to upload photo.");
    }
  };

  const onChangePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const current_password = String(fd.get("current_password") ?? "");
    const new_password = String(fd.get("new_password") ?? "");
    if (new_password.length === 0) {
      toast("No change requested.");
      return;
    }
    if (new_password.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    try {
      await changePassword({ current_password, new_password });
      toast.success("Password updated.");
      e.currentTarget.reset();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Unable to change password.");
    }
  };

  return (
    <section className="mx-auto max-w-[620px] py-9">
      <Link href="/account" className="text-sm font-semibold text-brand-fg hover:underline">
        ← Back to Account
      </Link>
      <h1 className="mt-4 text-3xl font-semibold text-fg">Edit Profile</h1>

      <div className="auth-card mt-6 p-8">
        <div className="flex items-center gap-5 border-b border-line pb-6">
          <Avatar url={user.avatar_url} name={user.full_name} />
          <div>
            <div className="flex gap-2.5">
              <button type="button" className="btn-outline px-3 py-1.5 text-sm" onClick={() => fileRef.current?.click()}>
                Upload photo
              </button>
              {user.avatar_url ? (
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-fg hover:bg-surface-hover"
                  onClick={async () => {
                    try {
                      await removeAvatar();
                    } catch (err) {
                      toast.error(err instanceof ApiClientError ? err.message : "Unable to remove photo.");
                    }
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-[13px] text-muted">JPG, PNG or WebP, square works best.</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => void onPickAvatar(e.target.files?.[0])}
            />
          </div>
        </div>

        <form onSubmit={onSaveProfile} className="mt-6 grid gap-4">
          <label className="block text-sm font-medium text-fg">
            Full Name
            <input className="input-field mt-1" name="full_name" defaultValue={user.full_name} />
          </label>
          <label className="block text-sm font-medium text-fg">
            Phone Number
            <input className="input-field mt-1 bg-surface-hover" value={user.phone_number} disabled />
            <span className="mt-1.5 block text-[12.5px] text-muted">
              Your phone number is used for sign-in and can&apos;t be changed here — contact support to update it.
            </span>
          </label>
          <label className="block text-sm font-medium text-fg">
            Address
            <input className="input-field mt-1" name="address" defaultValue={user.address ?? ""} />
          </label>
          <div className="flex justify-end gap-3">
            <Link href="/account" className="btn-outline h-11 px-5">
              Cancel
            </Link>
            <button type="submit" className="btn-primary inline-flex h-11 items-center px-5">
              Save Changes
            </button>
          </div>
        </form>

        <form onSubmit={onChangePassword} className="mt-8 grid gap-4 border-t border-line pt-6">
          <div>
            <h2 className="text-base font-bold text-fg">Change password</h2>
            <p className="text-[13px] text-muted">Leave blank to keep your current password.</p>
          </div>
          <label className="block text-sm font-medium text-fg">
            Current Password
            <input className="input-field mt-1" type="password" name="current_password" />
          </label>
          <label className="block text-sm font-medium text-fg">
            New Password
            <input
              className="input-field mt-1"
              type="password"
              name="new_password"
              placeholder="At least 8 characters"
            />
          </label>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary inline-flex h-11 items-center px-5">
              Update password
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}