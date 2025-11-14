import type { APIRoute } from "astro";
import { MercadoPagoConfig, Payment } from "mercadopago";

type PaymentPayload = {
  transaction_amount: number;
  token: string;
  description?: string;
  payment_method_id?: string;
  issuer_id?: string | number;
  installments?: number;
  payer?: { email?: string };
  payer_email?: string;
  external_reference?: string;
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json().catch(() => null)) as PaymentPayload | null;
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
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

    const transaction_amount = Number(body.transaction_amount);
    const token = String(body.token || "").trim();
    const payerEmail = String(body.payer?.email || body.payer_email || "").trim();
    if (!Number.isFinite(transaction_amount) || transaction_amount <= 0) {
      return new Response(JSON.stringify({ error: "transaction_amount must be a positive number" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (!token) {
      return new Response(JSON.stringify({ error: "token is required (card token)" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (!payerEmail) {
      return new Response(JSON.stringify({ error: "payer.email is required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const mp = new MercadoPagoConfig({ accessToken });
    const payments = new Payment(mp);

    const result = await payments.create({
      body: {
        transaction_amount: Number(transaction_amount.toFixed(2)),
        token,
        payment_method_id: body.payment_method_id || "yape",
        installments: body.installments || 1,
        payer: { email: payerEmail },
      },
    });

    return new Response(
      JSON.stringify({
        id: (result as any)?.id,
        status: (result as any)?.status,
        status_detail: (result as any)?.status_detail,
        transaction_amount,
        payer: { email: payerEmail },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (err: any) {
    const status = Number(err?.status || 500);
    const detail = err?.message || err?.errorMessage || "Unexpected error";
    const cause = err?.cause || err?.errors || undefined;
    const error = err?.error || undefined;
    const request_id = err?.request_id || err?.requestId || undefined;
    return new Response(
      JSON.stringify({ error: detail, error_code: error, cause, request_id }),
      { status, headers: { "content-type": "application/json" } }
    );
  }
};