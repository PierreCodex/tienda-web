import type { APIRoute } from "astro";
import { MercadoPagoConfig, Preference } from "mercadopago";

type PreferenceItem = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
};

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.items)) {
      return new Response(JSON.stringify({ error: "Invalid payload: items[] required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const accessToken = import.meta.env.MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;
    const currency = import.meta.env.MP_CURRENCY || process.env.MP_CURRENCY || "PEN";
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing MP_ACCESS_TOKEN in env" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const urlObj = typeof url === "string" ? new URL(url) : url;
    const origin = `${urlObj.protocol}//${urlObj.host}`;

    const items: PreferenceItem[] = (body.items as PreferenceItem[]).map((i) => ({
      title: i.title,
      quantity: Number(i.quantity || 1),
      unit_price: Number(i.unit_price || 0),
      currency_id: i.currency_id || currency,
    }));

    const mp = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(mp);

    const result = await preference.create({
      body: {
        items,
        back_urls: {
          success: `${origin}/checkout-success`,
          failure: `${origin}/checkout-failure`,
          pending: `${origin}/checkout-pending`,
        },
        // Algunos entornos muestran error con auto_return; eliminarlo evita 422 invalid.auto_return
        // auto_return: "approved",
        binary_mode: false,
      },
    });

    const { init_point, sandbox_init_point, id } = result || {};
    return new Response(
      JSON.stringify({ init_point: init_point || sandbox_init_point, id }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (err: any) {
    const status = Number(err?.status || 500);
    const detail = err?.message || err?.errorMessage || "Unexpected error";
    const cause = err?.cause || err?.errors || undefined;
    return new Response(
      JSON.stringify({ error: detail, cause }),
      { status, headers: { "content-type": "application/json" } }
    );
  }
};