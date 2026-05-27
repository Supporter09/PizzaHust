import { apiGet } from "@/lib/api/client";

export type OptionChoice = {
  value: string;
  label: string;
  priceDeltaVnd: number;
};

export type MenuItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  priceVnd: number;
  imageUrl: string;
  badge?: string;
  sizeOptions: OptionChoice[];
  crustOptions: OptionChoice[];
};

export type CatalogResult = {
  items: MenuItem[];
  fromFallback: boolean;
};

const FALLBACK_PIZZA_SIZE: OptionChoice[] = [
  { value: "S", label: "Small (8 inch)", priceDeltaVnd: 0 },
  { value: "M", label: "Medium (10 inch)", priceDeltaVnd: 30000 },
  { value: "L", label: "Large (12 inch)", priceDeltaVnd: 60000 },
];

const FALLBACK_PIZZA_CRUST: OptionChoice[] = [
  { value: "classic", label: "Classic Hand Tossed", priceDeltaVnd: 0 },
  { value: "thin", label: "Thin Crispy", priceDeltaVnd: 10000 },
  { value: "cheese", label: "Cheese Burst", priceDeltaVnd: 25000 },
];

export const FALLBACK_MENU_ITEMS: MenuItem[] = [
  {
    id: "pz-heo-kim-cheese",
    slug: "pizza-heo-nuong-kim-cheese",
    name: "Pizza Heo Nuong Kim Cheese",
    description: "Heo nuong, kimchi, mozzarella va sot cay ngot dac trung.",
    category: "Pizza",
    priceVnd: 229000,
    imageUrl:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1280&q=80",
    badge: "New",
    sizeOptions: FALLBACK_PIZZA_SIZE,
    crustOptions: FALLBACK_PIZZA_CRUST,
  },
  {
    id: "pz-double-pepperoni",
    slug: "double-pepperoni-tactical",
    name: "Double Pepperoni Tactical",
    description: "Double pepperoni, pho mai keo soi va herb seasoning.",
    category: "Pizza",
    priceVnd: 189000,
    imageUrl:
      "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=1280&q=80",
    sizeOptions: FALLBACK_PIZZA_SIZE,
    crustOptions: FALLBACK_PIZZA_CRUST,
  },
  {
    id: "pz-mushroom-truffle",
    slug: "mushroom-truffle-command",
    name: "Mushroom Truffle Command",
    description: "Nam xao bo toi, dau olive va huong truffle dam vi.",
    category: "Pizza",
    priceVnd: 249000,
    imageUrl:
      "https://images.unsplash.com/photo-1593504049359-74330189a345?auto=format&fit=crop&w=1280&q=80",
    sizeOptions: FALLBACK_PIZZA_SIZE,
    crustOptions: FALLBACK_PIZZA_CRUST,
  },
  {
    id: "cb-lunch-duo",
    slug: "lunch-duo-combo",
    name: "Lunch Duo Combo",
    description: "1 pizza vua + 2 side dish + 2 do uong cho bua trua nhanh.",
    category: "Combo",
    priceVnd: 279000,
    imageUrl:
      "https://images.unsplash.com/photo-1514326640560-7d063ef2aed5?auto=format&fit=crop&w=1280&q=80",
    badge: "Hot",
    sizeOptions: [],
    crustOptions: [],
  },
  {
    id: "sd-cheese-stick",
    slug: "cheese-stick-basket",
    name: "Cheese Stick Basket",
    description: "Que pho mai chien gion, an kem sot ca chua dac.",
    category: "Side",
    priceVnd: 79000,
    imageUrl:
      "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=1280&q=80",
    sizeOptions: [],
    crustOptions: [],
  },
  {
    id: "dr-lemon-soda",
    slug: "lemon-spark-soda",
    name: "Lemon Spark Soda",
    description: "Soda chanh mat lanh can bang vi beo cua pizza.",
    category: "Drink",
    priceVnd: 32000,
    imageUrl:
      "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1280&q=80",
    sizeOptions: [],
    crustOptions: [],
  },
];

function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

function parseOptions(value: unknown): OptionChoice[] {
  if (!Array.isArray(value)) return [];

  const options: OptionChoice[] = [];
  value.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const raw = entry as Record<string, unknown>;
    const itemValue = String(raw.value ?? raw.code ?? raw.id ?? `opt-${index}`);
    const label = String(raw.label ?? raw.name ?? itemValue);
    const deltaRaw = raw.price_delta_vnd ?? raw.delta ?? raw.extra_price ?? 0;
    const priceDeltaVnd = typeof deltaRaw === "number" ? deltaRaw : Number(deltaRaw);
    if (!Number.isFinite(priceDeltaVnd)) return;
    options.push({ value: itemValue, label, priceDeltaVnd });
  });
  return options;
}

function normalizeItems(payload: unknown): MenuItem[] {
  if (!Array.isArray(payload)) return [];

  const normalized: MenuItem[] = [];
  payload.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const raw = entry as Record<string, unknown>;

    const id = String(raw.id ?? raw.item_id ?? raw.slug ?? `item-${index}`);
    const name = String(raw.name ?? raw.title ?? "Unnamed item");
    const slug = String(raw.slug ?? slugify(name || id));
    const description = String(raw.description ?? raw.summary ?? "No description yet.");
    const category = String(raw.category ?? raw.category_name ?? "Other");
    const priceCandidate = raw.price_vnd ?? raw.price ?? raw.unit_price ?? 0;
    const priceVnd = typeof priceCandidate === "number" ? priceCandidate : Number(priceCandidate);
    const imageUrl = String(
      raw.image_url ??
        raw.image ??
        "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1280&q=80",
    );
    const badge = raw.badge ? String(raw.badge) : undefined;

    if (!Number.isFinite(priceVnd)) return;

    const parsedSize = parseOptions(raw.sizes ?? raw.size_options);
    const parsedCrust = parseOptions(raw.crusts ?? raw.crust_options);
    const isPizza = category.toLowerCase().includes("pizza");
    const sizeOptions = parsedSize.length > 0 ? parsedSize : isPizza ? FALLBACK_PIZZA_SIZE : [];
    const crustOptions = parsedCrust.length > 0 ? parsedCrust : isPizza ? FALLBACK_PIZZA_CRUST : [];

    normalized.push({
      id,
      slug,
      name,
      description,
      category,
      priceVnd,
      imageUrl,
      ...(badge ? { badge } : {}),
      sizeOptions,
      crustOptions,
    });
  });

  return normalized;
}

async function fetchItemsFromApi(): Promise<MenuItem[]> {
  const payload = await apiGet("/items");
  return normalizeItems(payload);
}

export async function getMenuCatalog(): Promise<CatalogResult> {
  try {
    const items = await fetchItemsFromApi();
    if (items.length > 0) {
      return { items, fromFallback: false };
    }
    return { items: FALLBACK_MENU_ITEMS, fromFallback: true };
  } catch {
    return { items: FALLBACK_MENU_ITEMS, fromFallback: true };
  }
}

export async function getMenuItemBySlug(slug: string): Promise<{ item: MenuItem | null; fromFallback: boolean }> {
  const result = await getMenuCatalog();
  const item = result.items.find((entry) => entry.slug === slug) ?? null;
  return { item, fromFallback: result.fromFallback };
}
