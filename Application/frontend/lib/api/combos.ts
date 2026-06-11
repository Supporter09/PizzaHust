import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type PublicCombo = components["schemas"]["PublicComboOut"];
export type PublicComboItem = components["schemas"]["PublicComboItemOut"];

export function fetchCombos(): Promise<PublicCombo[]> {
  return apiFetch<PublicCombo[]>("/combos");
}

export type ComboDetail = components["schemas"]["PublicComboDetailOut"];
export type ComboComponent = components["schemas"]["ComboComponentOut"];
export type ComboEligibleProduct = components["schemas"]["ComboEligibleProductOut"];

export function fetchComboDetail(id: number): Promise<ComboDetail> {
  return apiFetch<ComboDetail>(`/combos/${id}`);
}