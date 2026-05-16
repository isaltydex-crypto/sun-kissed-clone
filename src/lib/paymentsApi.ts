// ─────────────────────────────────────────────────────────────
// Payments API client
//
// Point this at your own server that integrates with Paymento.
// Set VITE_PAYMENTS_API_BASE_URL in your environment, e.g.
//   VITE_PAYMENTS_API_BASE_URL=https://api.your-domain.com
//
// Your server is expected to expose:
//
//   POST {BASE_URL}/api/crypto/create-invoice
//     Request JSON:
//       {
//         orderId: string,
//         amount: number,           // total in your store currency
//         currency: string,         // e.g. "SEK"
//         payCurrency?: "btc" | "eth" | "usdc" | "usdt",
//                                   // optional pre-selected coin (Paymento
//                                   // lets the buyer pick on its hosted page)
//         customer: { email, firstName, lastName, address,
//                     postalCode, city, phone, notes? },
//         items: { slug, name, price, quantity }[],
//         successUrl: string,       // ReturnUrl after payment
//         cancelUrl:  string        // shown if the buyer cancels
//       }
//     Response JSON:
//       { invoiceUrl: string, invoiceId: string }
//       — invoiceUrl is https://app.paymento.io/gateway?token=<token>
//       — invoiceId  is the Paymento payment-request token
//
//   GET  {BASE_URL}/api/crypto/order/:orderId
//     Response JSON:
//       { status: "pending" | "paid" | "failed" | "expired", ... }
//
//   POST {BASE_URL}/api/public/crypto/webhook   (called by Paymento IPN)
// ─────────────────────────────────────────────────────────────

export const PAYMENTS_API_BASE_URL: string =
  (import.meta.env.VITE_PAYMENTS_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export type PayCurrency = "btc" | "eth" | "usdc" | "usdt";

export type CreateInvoiceInput = {
  orderId: string;
  amount: number;
  currency: string;
  payCurrency: PayCurrency;
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    address: string;
    postalCode: string;
    city: string;
    phone: string;
    notes?: string;
  };
  items: { slug: string; name: string; price: number; quantity: number }[];
  /** Plain code string. The server validates and computes the discount. */
  discountCode?: string;
  successUrl: string;
  cancelUrl: string;
};

export type ServerDiscount = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  amount: number;
  description?: string;
};

export type CreateInvoiceResponse = {
  invoiceUrl: string;
  invoiceId: string;
  totals?: {
    subtotal: number;
    shipping: number;
    discount: ServerDiscount | null;
    total: number;
  };
};

export class PaymentsApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

function ensureBaseUrl(): string {
  if (!PAYMENTS_API_BASE_URL) {
    throw new PaymentsApiError(
      "Payments API base URL is not configured. Set VITE_PAYMENTS_API_BASE_URL to your server domain.",
    );
  }
  return PAYMENTS_API_BASE_URL;
}

export async function createCryptoInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResponse> {
  const base = ensureBaseUrl();
  const res = await fetch(`${base}/api/crypto/create-invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new PaymentsApiError(
      `Failed to create invoice (${res.status}). ${text}`.trim(),
      res.status,
    );
  }
  return (await res.json()) as CreateInvoiceResponse;
}

// ─── NOWPayments (Google Pay / Apple Pay / Samsung Pay) ────────────────
//
// Wired but not yet exposed in the checkout UI. Calls
//   POST {BASE_URL}/api/nowpayments/create-invoice
// which returns { invoiceUrl, invoiceId } — redirect the buyer to invoiceUrl.

export type NowPaymentsRail = "google_pay" | "apple_pay" | "samsung_pay";

export type CreateNowPaymentsInvoiceInput = Omit<CreateInvoiceInput, "amount" | "payCurrency"> & {
  rail: NowPaymentsRail;
};

export async function createNowPaymentsInvoice(
  input: CreateNowPaymentsInvoiceInput,
): Promise<CreateInvoiceResponse> {
  const base = ensureBaseUrl();
  const res = await fetch(`${base}/api/nowpayments/create-invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new PaymentsApiError(
      `Failed to create NOWPayments invoice (${res.status}). ${text}`.trim(),
      res.status,
    );
  }
  return (await res.json()) as CreateInvoiceResponse;
}

export async function getOrderStatus(orderId: string): Promise<{ status: string; [k: string]: unknown }> {
  const base = ensureBaseUrl();
  const res = await fetch(`${base}/api/crypto/order/${encodeURIComponent(orderId)}`);
  if (!res.ok) {
    throw new PaymentsApiError(`Failed to fetch order status (${res.status}).`, res.status);
  }
  return await res.json();
}

/**
 * Server-side discount validation. Returns the authoritative discount the
 * server will apply when creating the invoice. If no payments server is
 * configured this throws — call sites should fall back to local validation.
 */
export async function validateDiscountOnServer(
  code: string,
  items: { slug: string; price: number; quantity: number }[],
): Promise<
  | { ok: true; discount: ServerDiscount }
  | { ok: false; error: string }
> {
  const base = ensureBaseUrl();
  const res = await fetch(`${base}/api/discount/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, items }),
  });
  if (!res.ok) {
    return { ok: false, error: `Server error (${res.status})` };
  }
  return (await res.json()) as
    | { ok: true; discount: ServerDiscount }
    | { ok: false; error: string };
}
