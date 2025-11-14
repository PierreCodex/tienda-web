import type { APIContext } from 'astro';
import fs from 'fs/promises';
import path from 'path';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function POST({ request }: APIContext) {
  try {
    const data = await request.json();

    const title = String(data.title || '').trim();
    if (!title) {
      return new Response(JSON.stringify({ error: 'El campo "title" es requerido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const handleBase = String(data.handle || title);
    let handle = slugify(handleBase);

    const id = data.id || `prod_${Date.now()}`;
    const currencyCode = String(data.currencyCode || 'USD').toUpperCase();
    const amount = String(data.price || '0');

    const tags: string[] = Array.isArray(data.tags)
      ? data.tags
      : String(data.tags || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    const collections: string[] = Array.isArray(data.collections)
      ? data.collections
      : String(data.collections || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    const imageInputs: string[] = Array.isArray(data.images)
      ? data.images
      : [data.imageUrl].filter(Boolean);

    const images = imageInputs.map((url: string) => ({
      url,
      altText: String(data.imageAlt || title),
      width: 1024,
      height: 1024,
    }));

    const variants = Array.isArray(data.variants) && data.variants.length > 0
      ? data.variants
      : [
          {
            id: `var_${Date.now()}`,
            title: data.variantTitle || 'Default',
            availableForSale: true,
            selectedOptions: Array.isArray(data.selectedOptions) ? data.selectedOptions : [],
            price: { amount, currencyCode },
          },
        ];

    const product = {
      id,
      handle,
      availableForSale: true,
      title,
      description: String(data.description || ''),
      descriptionHtml: String(data.descriptionHtml || data.description || ''),
      vendor: String(data.vendor || ''),
      tags,
      collections,
      images,
      options: Array.isArray(data.options) ? data.options : [],
      variants,
      compareAtPrice: data.compareAtPrice ? String(data.compareAtPrice) : undefined,
    };

    const filePath = path.join(process.cwd(), 'src', 'data', 'products.json');
    const raw = await fs.readFile(filePath, 'utf-8').catch(() => '[]');
    const list = JSON.parse(raw);

    // Evitar conflicto de handle duplicado
    if (list.some((p: any) => p.handle === handle)) {
      handle = `${handle}-${Math.floor(Math.random() * 1000)}`;
      product.handle = handle;
    }

    list.push(product);
    await fs.writeFile(filePath, JSON.stringify(list, null, 2), 'utf-8');

    return new Response(JSON.stringify({ ok: true, product }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Solicitud inválida', details: String(err?.message || err) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}