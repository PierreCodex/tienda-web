import fs from "fs";
import path from "path";

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function readInputProductos(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const trimmed = raw.replace(/^\uFEFF/, "").trim();
  try {
    const parsed = JSON.parse(trimmed);
    return (parsed && parsed.data && Array.isArray(parsed.data.producto)) ? parsed.data.producto : [];
  } catch (_) {
    const keyIdx = trimmed.indexOf('"producto"');
    if (keyIdx === -1) return [];
    let start = trimmed.indexOf('[', keyIdx);
    if (start === -1) return [];
    let level = 0;
    let end = -1;
    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '[') level++;
      else if (ch === ']') {
        level--;
        if (level === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) return [];
    const segment = trimmed.slice(start, end + 1);
    try {
      const arr = JSON.parse(segment);
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function pickImage(item) {
  const url = item.imagen_medium || item.imagen_regular || item.imagen_small || item.imagen_micro || "";
  const width = parseInt(item.imagen_small_ancho || "800", 10) || 800;
  const height = parseInt(item.imagen_small_alto || "800", 10) || 800;
  return { url, altText: item.name, width, height };
}

function currencyCodeFromPrecio(precio) {
  const s = String(precio || "").toUpperCase();
  if (s.includes("S/")) return "S/";
  return "USD";
}

function mapItemToLocalProduct(item) {
  const id = String(item.id || `prod_${Date.now()}`);
  const handle = String(item.name_url || "").trim() || String(item.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const available = Number(item.stock || 0) > 0 || String(item.stock || "0") === "1";
  const amount = String(item.precio_meta || "0").replace(/,/g, ".");
  const currencyCode = currencyCodeFromPrecio(item.precio);
  const image = pickImage(item);
  return {
    id,
    handle,
    availableForSale: available,
    title: String(item.name || "").trim(),
    description: "",
    descriptionHtml: "",
    vendor: "MiMarca",
    tags: [],
    collections: [],
    images: [image],
    options: [],
    variants: [
      {
        id: `var_${id}`,
        title: "Default",
        availableForSale: available,
        selectedOptions: [],
        price: { amount, currencyCode },
      },
    ],
    compareAtPrice: undefined,
  };
}

function main() {
  const root = process.cwd();
  const inputPath = path.join(root, "lista de productos.txt");
  const outputPath = path.join(root, "src", "data", "products.json");

  const items = readInputProductos(inputPath);
  const existing = readJsonFile(outputPath);

  const handles = new Set(existing.map((p) => String(p.handle)));
  const toAdd = [];
  for (const it of items) {
    const p = mapItemToLocalProduct(it);
    if (!handles.has(p.handle)) {
      toAdd.push(p);
      handles.add(p.handle);
    }
  }

  const updated = existing.concat(toAdd);
  writeJsonFile(outputPath, updated);

  console.log(JSON.stringify({ found: items.length, added: toAdd.length, total: updated.length }));
}

main();