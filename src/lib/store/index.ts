import type { Cart, Collection, Menu, Page, PageInfo, Product, CustomerInput, user, ProductVariant, Image, Money, CartItem } from "./types";
import productsRaw from "../../data/products.json";

const emptyPageInfo: PageInfo = {
  hasNextPage: false,
  hasPreviousPage: false,
  endCursor: "",
};

const defaultCurrency = (() => {
  try {
    const first = (productsRaw as any[])[0];
    return normalizeCurrencyCode(first?.variants?.[0]?.price?.currencyCode) || "USD";
  } catch {
    return "USD";
  }
})();

function normalizeCurrencyCode(code?: string): string {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return "USD";
  if (c === "SOLES" || c === "S/" || c === "SOL" || c === "SOLES PERUANOS") return "PEN";
  if (c === "US$" || c === "DOLARES" || c === "USD$") return "USD";
  return c;
}

function makeEmptyCart(id: string): Cart {
  return {
    id,
    checkoutUrl: "/checkout",
    cost: {
      subtotalAmount: { amount: "0", currencyCode: defaultCurrency },
      totalAmount: { amount: "0", currencyCode: defaultCurrency },
      totalTaxAmount: { amount: "0", currencyCode: defaultCurrency },
    },
    lines: [],
    totalQuantity: 0,
  };
}

const isBrowser = typeof window !== "undefined";

function storageKey(cartId: string) {
  return `cart:${cartId}`;
}

function findVariant(variantId: string | undefined): { variant: ProductVariant | null; product: Product | null } {
  if (!variantId) return { variant: null, product: null };
  const list = (productsRaw as any[]);
  for (const p of list) {
    const v = (p.variants || []).find((x: any) => x.id === variantId);
    if (v) {
      return { variant: {
        id: v.id,
        title: v.title || "",
        availableForSale: v.availableForSale ?? true,
        selectedOptions: v.selectedOptions || [],
        price: v.price as Money,
      }, product: mapLocalToProduct(p) };
    }
  }
  return { variant: null, product: null };
}

function recalcTotals(cart: Cart): Cart {
  const currency = normalizeCurrencyCode(cart.cost.totalAmount.currencyCode || defaultCurrency);
  let subtotal = 0;
  let totalQty = 0;
  for (const line of cart.lines) {
    let priceNum = 0;
    const maybeAmount = (line as any)?.merchandise?.price?.amount;
    if (typeof maybeAmount === "string" && maybeAmount.length > 0) {
      priceNum = parseFloat(maybeAmount);
    } else {
      const { variant } = findVariant(line.merchandise.id);
      if (variant?.price?.amount) {
        priceNum = parseFloat(variant.price.amount);
        (line as any).merchandise.price = variant.price;
      }
    }
    const qty = line.quantity || 0;
    const lineTotal = priceNum * qty;
    line.cost.totalAmount = { amount: String(lineTotal), currencyCode: currency };
    subtotal += lineTotal;
    totalQty += qty;
  }
  cart.cost.subtotalAmount = { amount: String(subtotal), currencyCode: currency };
  cart.cost.totalAmount = { amount: String(subtotal), currencyCode: currency };
  cart.cost.totalTaxAmount = { amount: "0", currencyCode: currency };
  cart.totalQuantity = totalQty;
  return cart;
}

function loadCart(cartId: string): Cart | undefined {
  if (!isBrowser) return undefined;
  try {
    const raw = window.localStorage.getItem(storageKey(cartId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    const cart: Cart = {
      id: parsed.id || cartId,
      checkoutUrl:
        parsed.checkoutUrl && parsed.checkoutUrl !== "#"
          ? parsed.checkoutUrl
          : "/checkout",
      cost: parsed.cost || {
        subtotalAmount: { amount: "0", currencyCode: defaultCurrency },
        totalAmount: { amount: "0", currencyCode: defaultCurrency },
        totalTaxAmount: { amount: "0", currencyCode: defaultCurrency },
      },
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
      totalQuantity: parsed.totalQuantity || 0,
    };
    const updated = recalcTotals(cart);
    saveCart(updated);
    return updated;
  } catch {
    return undefined;
  }
}

function saveCart(cart: Cart) {
  if (!isBrowser) return;
  const updated = recalcTotals(cart);
  window.localStorage.setItem(storageKey(cart.id), JSON.stringify(updated));
}

export async function createCart(): Promise<Cart> {
  const id = `cart_${Date.now()}`;
  const cart = makeEmptyCart(id);
  saveCart(cart);
  return cart;
}

export async function addToCart(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[],
): Promise<Cart> {
  const cart = loadCart(cartId) || makeEmptyCart(cartId);
  for (const l of lines) {
    const { variant, product } = findVariant(l.merchandiseId);
    if (!variant || !product) continue;
    const existing = cart.lines.find((x) => x.merchandise.id === variant.id);
    if (existing) {
      existing.quantity += l.quantity;
    } else {
      const line: CartItem = {
        id: `line_${variant.id}`,
        quantity: l.quantity,
        cost: { totalAmount: { amount: "0", currencyCode: variant.price.currencyCode } },
        merchandise: {
          id: variant.id,
          title: variant.title,
          selectedOptions: variant.selectedOptions,
          product,
          price: variant.price as any,
        },
      };
      cart.lines.push(line);
    }
  }
  saveCart(cart);
  return cart;
}

export async function removeFromCart(
  cartId: string,
  lineIds: string[],
): Promise<Cart> {
  const cart = loadCart(cartId) || makeEmptyCart(cartId);
  cart.lines = cart.lines.filter((x) => !lineIds.includes(x.id));
  saveCart(cart);
  return cart;
}

export async function updateCart(
  cartId: string,
  lines: { id: string; merchandiseId: string; quantity: number }[],
): Promise<Cart> {
  const cart = loadCart(cartId) || makeEmptyCart(cartId);
  for (const l of lines) {
    const idx = cart.lines.findIndex((x) => x.id === l.id);
    if (idx === -1) continue;
    if (l.quantity === 0) {
      cart.lines.splice(idx, 1);
      continue;
    }
    const { variant, product } = findVariant(l.merchandiseId);
    if (variant && product) {
      cart.lines[idx].merchandise = {
        id: variant.id,
        title: variant.title,
        selectedOptions: variant.selectedOptions,
        product,
        price: variant.price as any,
      };
    }
    cart.lines[idx].quantity = l.quantity;
  }
  saveCart(cart);
  return cart;
}

export async function getCart(cartId: string): Promise<Cart | undefined> {
  return loadCart(cartId);
}

export async function getCollection(_handle: string): Promise<Collection | undefined> {
  return undefined;
}

export async function createCustomer(_input: CustomerInput): Promise<any> {
  return { customer: null, customerCreateErrors: [{ code: "DISABLED", field: [], message: "Customer creation disabled" }] };
}

export async function getCustomerAccessToken(_payload: Partial<CustomerInput>): Promise<any> {
  return { token: null, customerLoginErrors: [{ code: "DISABLED", field: [], message: "Login disabled" }] };
}

export async function getUserDetails(_accessToken: string): Promise<user> {
  return { customer: { firstName: "", lastName: "", email: "", acceptsMarketing: false } } as user;
}

export async function getCollections(): Promise<Collection[]> {
  const titles = Array.from(
    new Set(
      (productsRaw as any[])
        .flatMap((p) => (p.collections || []))
        .filter(Boolean),
    ),
  );

  const slugify = (str: string) =>
    str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  return titles.map((title) => ({
    handle: slugify(title),
    title,
    description: "",
    seo: { title, description: "" },
    updatedAt: "",
    path: `/products/${slugify(title)}`,
  }));
}

export async function getMenu(_handle: string): Promise<Menu[]> {
  return [];
}

export async function getPage(_handle: string): Promise<Page> {
  return { id: "", title: "", handle: "", body: "", bodySummary: "", createdAt: "", updatedAt: "" } as Page;
}

export async function getPages(): Promise<Page[]> {
  return [];
}

export async function getProduct(_handle: string): Promise<Product | undefined> {
  const found = (productsRaw as any[]).find((p) => p.handle === _handle);
  return found ? mapLocalToProduct(found) : undefined;
}

export async function getProductRecommendations(_productId: string): Promise<Product[]> {
  const others = (productsRaw as any[]).filter((p) => p.id !== _productId);
  return others.map(mapLocalToProduct);
}

export async function getVendors(_args: { query?: string; reverse?: boolean; sortKey?: string }): Promise<{ vendor: string; productCount: number }[]> {
  const list = (productsRaw as any[]).filter((p) => !!p.vendor);
  const vendors = Array.from(new Set(list.map((p) => p.vendor)));
  return vendors.map((vendor) => ({
    vendor,
    productCount: list.filter((p) => p.vendor === vendor).length,
  }));
}

export async function getTags(_args: { query?: string; reverse?: boolean; sortKey?: string }): Promise<Product[]> {
  return (productsRaw as any[]).map(mapLocalToProduct);
}

export async function getProducts(_args: { query?: string; reverse?: boolean; sortKey?: string; cursor?: string }): Promise<{ pageInfo: PageInfo; products: Product[] }> {
  const products = (productsRaw as any[]).map(mapLocalToProduct);
  return { pageInfo: emptyPageInfo, products };
}

export async function getHighestProductPrice(): Promise<{ amount: string; currencyCode: string } | null> {
  const prices = (productsRaw as any[])
    .flatMap((p) => p.variants || [])
    .map((v) => parseFloat(v.price?.amount || "0"))
    .filter((n) => !isNaN(n));
  if (prices.length === 0) return null;
  const max = Math.max(...prices);
  const currencyCode = (productsRaw as any[])[0]?.variants?.[0]?.price?.currencyCode || "USD";
  return { amount: String(max), currencyCode };
}

export async function getCollectionProducts({
  collection: _collection,
  reverse: _reverse,
  sortKey: _sortKey,
}: {
  collection: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<{ pageInfo: PageInfo | null; products: Product[] }> {
  const products = (productsRaw as any[])
    .filter((p) => (p.collections || []).some((c: string) => slugify(c) === slugify(_collection)))
    .map(mapLocalToProduct);
  return { pageInfo: emptyPageInfo, products };
}

const slugify = (str: string) =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function mapLocalToProduct(p: any): Product {
  const variants: ProductVariant[] = (p.variants || []).map((v: any) => ({
    id: v.id,
    title: v.title || "",
    availableForSale: v.availableForSale ?? true,
    selectedOptions: v.selectedOptions || [],
    price: { amount: String((v.price as any)?.amount || v.price?.amount || 0), currencyCode: normalizeCurrencyCode((v.price as any)?.currencyCode || v.price?.currencyCode || defaultCurrency) },
  }));

  const images: Image[] = (p.images || []).map((img: any) => ({
    url: img.url,
    altText: img.altText || p.title,
    width: img.width || 800,
    height: img.height || 800,
  }));

  const prices = variants.map((v) => parseFloat(v.price.amount || "0")).filter((n) => !isNaN(n));
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;
  const currencyCode = normalizeCurrencyCode(variants[0]?.price?.currencyCode || defaultCurrency);

  return {
    id: p.id,
    handle: p.handle,
    availableForSale: p.availableForSale ?? true,
    title: p.title,
    description: p.description || "",
    descriptionHtml: p.descriptionHtml || p.description || "",
    options: p.options || [],
    priceRange: {
      minVariantPrice: { amount: String(min), currencyCode },
      maxVariantPrice: { amount: String(max), currencyCode },
    },
    compareAtPriceRange: {
      maxVariantPrice: { amount: String(p.compareAtPrice || 0), currencyCode },
    },
    featuredImage: images[0] || { url: "/images/product-placeholder.jpg", altText: p.title, width: 800, height: 800 },
    variants: variants,
    images: images,
    seo: p.seo || { title: p.title, description: p.description || "" },
    tags: p.tags || [],
    updatedAt: p.updatedAt || "",
    vendor: p.vendor || "",
    collections: { nodes: (p.collections || []).map((t: string) => ({ title: t, handle: slugify(t) })) },
  } as Product;
}