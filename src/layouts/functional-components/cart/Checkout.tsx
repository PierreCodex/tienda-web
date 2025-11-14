import React, { useEffect, useRef, useState } from "react";
import { initMercadoPago, Wallet } from "@mercadopago/sdk-react";
import { useStore } from "@nanostores/react";
import { cart, refreshCartState, totalQuantity } from "@/cartStore";
import Price from "../Price";

type CheckoutProps = {
  hasMpToken?: boolean;
};

const Checkout: React.FC<CheckoutProps> = ({ hasMpToken = false }) => {
  const currentCart = useStore(cart);
  const qty = useStore(totalQuantity);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const walletBrickRef = useRef<any>(null);
  const paymentBrickRef = useRef<any>(null);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [yapePhone, setYapePhone] = useState("");
  const [yapeOtp, setYapeOtp] = useState("");
  const [mpReady, setMpReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      setInitializing(true);
      try {
        await refreshCartState();
      } finally {
        setInitializing(false);
      }
    };
    init();
  }, []);

  const placeOrder = async () => {
    setMessage("Checkout no implementado: esto es una vista de resumen.");
  };

  const handleMercadoPagoCheckout = async () => {
    try {
      setLoading(true);
      if (!hasMpToken) {
        throw new Error(
          "Falta MP_ACCESS_TOKEN en .env. Agrega tu Access Token de prueba y reinicia el servidor."
        );
      }
      const items = (currentCart?.lines || []).map((item) => {
        const qty = Number(item.quantity || 1);
        const priceStr = (item as any)?.merchandise?.price?.amount as string | undefined;
        const totalStr = (item as any)?.cost?.totalAmount?.amount as string | undefined;
        let unit = 0;
        if (priceStr && priceStr.length > 0) {
          unit = parseFloat(priceStr);
        } else if (totalStr && qty > 0) {
          unit = parseFloat(totalStr) / qty;
        }
        const unit_price = Math.max(0.01, Number.isFinite(unit) ? unit : 0);

        return {
          title: item.merchandise?.product?.title || item.merchandise?.title || "Producto",
          quantity: qty,
          unit_price,
          currency_id: "PEN",
        };
      });

      const res = await fetch("/api/mp/create-preference", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok || !data?.init_point) {
        throw new Error(data?.error || "No se pudo crear la preferencia");
      }
      // Redirección clásica (Checkout Pro) ya no se usa en opción incrustada
      // window.location.href = data.init_point;
      // Guardamos el preferenceId para usarlo en el Wallet Brick
      if (data?.id) setPreferenceId(data.id);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Cargar SDK JS de MercadoPago si no está presente
  const ensureMpSdk = async () => {
    if ((window as any).MercadoPago) return;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://sdk.mercadopago.com/js/v2";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("No se pudo cargar el SDK de Mercado Pago"));
      document.head.appendChild(script);
    });
  };

  // Montar Payment Brick (tarjeta) cuando haya items y credenciales
  useEffect(() => {
    const mountBricks = async () => {
      if (!hasMpToken || !currentCart || qty === 0) {
        // Si no hay token o está vacío, desmontar si existe
        try {
          if (paymentBrickRef.current) {
            paymentBrickRef.current.unmount?.();
            paymentBrickRef.current = null;
          }
        } catch {}
        return;
      }

      const publicKey = (import.meta as any).env?.PUBLIC_MP_PUBLIC_KEY || (import.meta as any).env?.MP_PUBLIC_KEY;
      if (!publicKey) {
        setMessage("Falta PUBLIC_MP_PUBLIC_KEY en .env para inicializar Bricks");
        return;
      }

      // No bloquear el render para mantener presente el contenedor "payment_container"
      setMessage(null);
      try {
        try {
          initMercadoPago(publicKey, { locale: "es-PE" });
          setMpReady(true);
        } catch {}
        await ensureMpSdk();
        const mp = new (window as any).MercadoPago(publicKey, { locale: "es-PE" });
        const bricksBuilder = mp.bricks();

        // Desmontar ladrillos previos si existen
        try {
          if (paymentBrickRef.current) {
            paymentBrickRef.current.unmount?.();
            paymentBrickRef.current = null;
          }
        } catch {}

        // Payment Brick: sólo tarjetas
        const amount = Number((currentCart as any)?.cost?.totalAmount?.amount || 0);
        paymentBrickRef.current = await bricksBuilder.create("payment", "payment_container", {
          initialization: {
            amount,
          },
          customization: {
            paymentMethods: {
              creditCard: "all",
              debitCard: "all",
              ticket: "none",
              bankTransfer: "none",
            },
            visual: { style: { theme: "flat" } },
          },
          callbacks: {
            onReady: () => {},
            onSubmit: async ({ formData }: any) => {
              try {
                const resp = await fetch("/api/mp/create-payment", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    ...formData,
                    transaction_amount: amount,
                    description: "Compra en tienda artesanal",
                    payer_email: customerEmail,
                  }),
                });
                const data = await resp.json();
                if (!resp.ok) {
                  throw new Error(data?.error || "Pago rechazado");
                }
                if (data?.status === "approved") {
                  window.location.href = "/checkout-success";
                } else if (data?.status === "pending") {
                  window.location.href = "/checkout-pending";
                } else {
                  window.location.href = "/checkout-failure";
                }
                return data;
              } catch (error: any) {
                setMessage(error?.message || "Error procesando el pago");
                return { error: error?.message };
              }
            },
            onError: (error: any) => {
              console.error("MP Payment Brick error", error);
              setMessage(error?.message || "Error inicializando Payment Brick");
            },
          },
        });
      } catch (e: any) {
        setMessage(e?.message || "Error montando pago con tarjeta");
      } finally {
        // No cambiar estado de "loading" general para evitar ocultar el contenedor
      }
    };

    mountBricks();
    // Desmontaje al salir
    return () => {
      try {
        if (paymentBrickRef.current) {
          paymentBrickRef.current.unmount?.();
          paymentBrickRef.current = null;
        }
      } catch {}
    };
  }, [qty, hasMpToken, currentCart]);

  if (initializing) {
    return <p className="p-4">Cargando carrito...</p>;
  }

  if (!currentCart || qty === 0) {
    return (
      <div className="container mx-auto max-w-3xl p-4">
        <h1 className="text-2xl font-semibold mb-4">Checkout</h1>
        <p>Tu carrito está vacío.</p>
        <a href="/products" className="btn btn-primary mt-4">Volver a productos</a>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl p-4">
      <h1 className="text-2xl font-semibold mb-4">Checkout</h1>

      <div className="mb-6 border border-amber-200 bg-amber-50 rounded-lg p-6">
        <h2 className="text-xl font-medium mb-3">Resumen del pedido</h2>
        <ul className="divide-y">
          {currentCart.lines.map((item) => (
            <li key={item.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="font-medium">{item.merchandise.product.title}</p>
                {item.merchandise.title && (
                  <p className="text-sm text-neutral-600">{item.merchandise.title}</p>
                )}
                <p className="text-sm">Cantidad: {item.quantity}</p>
              </div>
              <Price
                amount={item.cost.totalAmount.amount}
                currencyCode={item.cost.totalAmount.currencyCode}
                className="text-base"
              />
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <Price
              amount={currentCart.cost.subtotalAmount.amount}
              currencyCode={currentCart.cost.subtotalAmount.currencyCode}
            />
          </div>
          <div className="flex justify-between">
            <span>Impuestos</span>
            <Price
              amount={currentCart.cost.totalTaxAmount.amount}
              currencyCode={currentCart.cost.totalTaxAmount.currencyCode}
            />
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <Price
              amount={currentCart.cost.totalAmount.amount}
              currencyCode={currentCart.cost.totalAmount.currencyCode}
            />
          </div>
        </div>
      </div>

      <div className="mb-6 border rounded-md p-4">
        <h2 className="text-xl font-medium mb-3">Datos del cliente</h2>
        <p className="text-sm text-neutral-600">Usaremos tu email para emitir el comprobante y procesar el pago.</p>
        <div className="grid grid-cols-1 gap-3 mt-3">
          <input className="input" placeholder="Nombre" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <input className="input" placeholder="Email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
          <input className="input" placeholder="Dirección" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
          <input className="input" placeholder="Ciudad" value={customerCity} onChange={(e) => setCustomerCity(e.target.value)} />
        </div>
      </div>

      <div className="mb-6 border border-amber-200 bg-amber-50 rounded-lg p-6">
        <h2 className="text-xl font-medium mb-3">Pago</h2>
        <p className="text-sm text-neutral-600 mb-3">
          Pago en sitio con Mercado Pago, usando un estilo propio acorde a tu marca artesanal.
        </p>
        {qty === 0 && (
          <div className="text-sm text-neutral-600 mb-2">Agrega productos al carrito para habilitar el pago.</div>
        )}
        {!hasMpToken && (
          <div className="text-sm text-red-600 mb-2">
            Aviso: Falta MP_ACCESS_TOKEN en .env. Obtén tu Access Token de prueba en Mercado Pago y reinicia el servidor.
          </div>
        )}
        <div id="payment_container" className="mt-2 mb-4" />
        {mpReady && preferenceId && (
          <div className="mt-2" style={{ maxWidth: 320 }}>
            <Wallet initialization={{ preferenceId }} />
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 gap-3">
          <h3 className="text-lg font-medium">Pagar con Yape</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="input" placeholder="Celular" value={yapePhone} onChange={(e) => setYapePhone(e.target.value)} />
            <input className="input" placeholder="OTP de Yape" value={yapeOtp} onChange={(e) => setYapeOtp(e.target.value)} />
          </div>
          <button
            className="btn btn-primary w-full sm:w-auto"
            onClick={async () => {
              try {
                setLoading(true);
                setMessage(null);
                const publicKey = (import.meta as any).env?.PUBLIC_MP_PUBLIC_KEY || (import.meta as any).env?.MP_PUBLIC_KEY;
                await ensureMpSdk();
                const mp = new (window as any).MercadoPago(publicKey, { locale: "es-PE" });
                const yape = mp.yape({ otp: yapeOtp, phoneNumber: yapePhone });
                const token = await yape.create();
                const amount = Number((currentCart as any)?.cost?.totalAmount?.amount || 0);
                const resp = await fetch("/api/mp/create-payment", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    transaction_amount: amount,
                    token,
                    payment_method_id: "yape",
                    payer_email: customerEmail,
                    description: "Compra en tienda artesanal",
                  }),
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data?.error || "Pago Yape rechazado");
                if (data?.status === "approved") {
                  window.location.href = "/checkout-success";
                } else if (data?.status === "pending") {
                  window.location.href = "/checkout-pending";
                } else {
                  window.location.href = "/checkout-failure";
                }
              } catch (error: any) {
                setMessage(error?.message || "Error procesando pago con Yape");
              } finally {
                setLoading(false);
              }
            }}
          >
            Confirmar pago Yape
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-red-600">{message}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button className="btn btn-outline w-full" onClick={placeOrder}>
          Finalizar compra (demo)
        </button>
      </div>
    </div>
  );
};

export default Checkout;