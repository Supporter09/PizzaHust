export interface ComboComponentLabel {
  kind: "product" | "category";
  name: string;
  quantity: number;
}

export function formatComboComponent(c: ComboComponentLabel): string {
  return `${c.quantity}× ${c.name}`;
}