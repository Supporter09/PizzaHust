import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type AdminCombo = components["schemas"]["ComboOut"];
export type AdminComboIn = components["schemas"]["ComboIn"];
export type AdminComboPatch = components["schemas"]["ComboPatch"];
export type AdminComboItemIn = AdminComboIn["items"][number];

export const listCombos = () => apiFetch<AdminCombo[]>("/admin/combos");

export const getCombo = (id: number) => apiFetch<AdminCombo>(`/admin/combos/${id}`);

export const createCombo = (body: AdminComboIn) =>
  apiFetch<AdminCombo>("/admin/combos", { method: "POST", body: JSON.stringify(body) });

export const patchCombo = (id: number, body: AdminComboPatch) =>
  apiFetch<AdminCombo>(`/admin/combos/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteCombo = (id: number) =>
  apiFetch<void>(`/admin/combos/${id}`, { method: "DELETE" });

export const uploadComboImage = (id: number, file: File) => {
  const fd = new FormData();
  fd.append("image", file);
  return apiFetch<{ image_url: string }>(`/admin/combos/${id}/image`, {
    method: "POST",
    body: fd,
  });
};

export const deleteComboImage = (id: number) =>
  apiFetch<void>(`/admin/combos/${id}/image`, { method: "DELETE" });