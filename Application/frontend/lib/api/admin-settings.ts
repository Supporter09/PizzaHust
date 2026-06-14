import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type SettingsOut = components["schemas"]["SettingsOut"];
export type SettingsIn = components["schemas"]["SettingsIn"];
export type WardFeesOut = components["schemas"]["WardFeesOut"];
export type WardFeesIn = components["schemas"]["WardFeesIn"];

export const getSettings = () => apiFetch<SettingsOut>("/admin/settings");

export const putSettings = (body: SettingsIn) =>
  apiFetch<SettingsOut>("/admin/settings", {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const getWardFees = () => apiFetch<WardFeesOut>("/admin/settings/ward-fees");

export const putWardFees = (body: WardFeesIn) =>
  apiFetch<WardFeesOut>("/admin/settings/ward-fees", {
    method: "PUT",
    body: JSON.stringify(body),
  });
