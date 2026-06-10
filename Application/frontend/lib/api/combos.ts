import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type PublicCombo = components["schemas"]["PublicComboOut"];
export type PublicComboItem = components["schemas"]["PublicComboItemOut"];

export function fetchCombos(): Promise<PublicCombo[]> {
  return apiFetch<PublicCombo[]>("/combos");
}