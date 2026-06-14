import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type AdminGroup = components["schemas"]["GroupOut"];
export type AdminItemOptionGroup = components["schemas"]["ItemOptionGroupOut"];
export type AdminItemOption = components["schemas"]["ItemOptionOut"];
export type AdminCategoryOptionGroup = components["schemas"]["CategoryOptionGroupOut"];

export const listItemOptions = (productId: number) =>
  apiFetch<AdminItemOptionGroup[]>(`/admin/items/${productId}/options`);

export const listCategoryOptionGroups = (categoryId: number) =>
  apiFetch<AdminCategoryOptionGroup[]>(`/admin/categories/${categoryId}/option-groups`);

export const replaceItemOptions = (productId: number, optionIds: number[]) =>
  apiFetch<AdminItemOptionGroup[]>(`/admin/items/${productId}/options`, {
    method: "PUT",
    body: JSON.stringify({ option_ids: optionIds }),
  });

export const createGroup = (body: components["schemas"]["GroupIn"]) =>
  apiFetch<AdminGroup>("/admin/option-groups", { method: "POST", body: JSON.stringify(body) });

export const patchGroup = (id: number, body: components["schemas"]["GroupPatch"]) =>
  apiFetch<AdminGroup>(`/admin/option-groups/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const deleteGroup = (id: number) =>
  apiFetch<void>(`/admin/option-groups/${id}`, { method: "DELETE" });

export const createOption = (groupId: number, body: components["schemas"]["OptionIn"]) =>
  apiFetch<components["schemas"]["OptionOut"]>(`/admin/option-groups/${groupId}/options`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const patchOption = (id: number, body: components["schemas"]["OptionPatch"]) =>
  apiFetch<components["schemas"]["OptionOut"]>(`/admin/options/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const deleteOption = (id: number) =>
  apiFetch<void>(`/admin/options/${id}`, { method: "DELETE" });
