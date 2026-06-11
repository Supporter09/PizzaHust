// Initial customizer selections for a dish's option groups: required single-select
// groups default to their first option (matches U3); everything else starts empty.

import type { MenuItemDetail } from "@/lib/api/menu";

type Groups = MenuItemDetail["option_groups"];

export function defaultOptionSelections(groups: Groups): Record<number, number[]> {
  const initial: Record<number, number[]> = {};
  for (const g of groups) {
    initial[g.group_id] =
      g.select_type === "single" && g.required && g.options.length > 0
        ? [g.options[0].option_id]
        : [];
  }
  return initial;
}