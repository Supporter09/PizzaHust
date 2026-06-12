import type { components } from "@/lib/api/types";

export type CartOut = components["schemas"]["CartOut"];
export type CartLineOut = components["schemas"]["CartLineOut"];
export type AddLinePayload =
  | components["schemas"]["AddItemLineIn"]
  | components["schemas"]["ComboQuoteLineIn"];