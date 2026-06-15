import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type LoyaltyMeResponse = components["schemas"]["LoyaltyMeResponse"];
export type LoyaltyHistoryRow = components["schemas"]["LoyaltyHistoryRow"];
export type LoyaltyConfigOut = components["schemas"]["LoyaltyConfigOut"];

export function getLoyaltyMe(): Promise<LoyaltyMeResponse> {
  return apiFetch<LoyaltyMeResponse>("/loyalty/me");
}

export function getLoyaltyHistory(): Promise<LoyaltyHistoryRow[]> {
  return apiFetch<LoyaltyHistoryRow[]>("/loyalty/me/history");
}

export function getLoyaltyConfig(): Promise<LoyaltyConfigOut> {
  return apiFetch<LoyaltyConfigOut>("/config/loyalty");
}