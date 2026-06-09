import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type MenuCategory = components["schemas"]["MenuCategoryOut"];
export type MenuItem = components["schemas"]["MenuItemOut"];

export function fetchCategories(): Promise<MenuCategory[]> {
  return apiFetch<MenuCategory[]>("/categories");
}

export function fetchItems(): Promise<MenuItem[]> {
  return apiFetch<MenuItem[]>("/items");
}