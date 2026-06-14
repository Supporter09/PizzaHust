import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type DeliveryConfigOut = components["schemas"]["DeliveryConfigOut"];

export function getDeliveryConfig(): Promise<DeliveryConfigOut> {
  return apiFetch<DeliveryConfigOut>("/config/delivery");
}

export type BusinessConfig = { timezone: string };

export const getBusinessConfig = () => apiFetch<BusinessConfig>("/config/business");