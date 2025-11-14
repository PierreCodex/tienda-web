import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  const accessToken = import.meta.env.MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;
  const publicKey = import.meta.env.MP_PUBLIC_KEY || process.env.MP_PUBLIC_KEY;
  if (!accessToken && !publicKey) {
    return new Response(JSON.stringify({ error: "Missing MP_ACCESS_TOKEN or MP_PUBLIC_KEY in env" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    let url = "https://api.mercadopago.com/v1/payment_methods";
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    } else if (publicKey) {
      url = `${url}?public_key=${encodeURIComponent(publicKey)}`;
    }

    const resp = await fetch(url, { headers });
    const data = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: data?.error || "Error fetching payment methods" }), {
        status: resp.status,
        headers: { "content-type": "application/json" },
      });
    }
    const filtered = Array.isArray(data) ? data.filter((m: any) => !m.site_id || m.site_id === "MPE") : data;
    return new Response(JSON.stringify(filtered), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};