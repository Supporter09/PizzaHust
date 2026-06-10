// Composes the cart/kitchen line text from a dish name and its selected options,
// e.g. "Margherita Classic (M) · Regular crust · Extra Cheese" (DESIGN_BRIEF §4).
// Selections must already be in display order (group sort, then option sort).

export type LineSelection = { groupName: string; optionName: string };

export function composeLineText(name: string, selections: LineSelection[]): string {
  if (selections.length === 0) return name;
  const [first, ...rest] = selections;
  const head = `${name} (${first.optionName})`;
  return rest.length === 0 ? head : `${head} · ${rest.map((s) => s.optionName).join(" · ")}`;
}
