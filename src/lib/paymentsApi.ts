// ─────────────────────────────────────────────────────────────
// Payments API client
//
// Point this at your own server that integrates with NOWPayments.
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
//         payCurrency: "btc" | "eth" | "usdc" | "usdt",
//         customer: { email, firstName, lastName, address,
//                     postalCode, city, phone, notes? },
//         items: { slug, name, price, quantity }[],
//         successUrl: string,       // where NOWPayments returns on success
//         cancelUrl:  string        // where NOWPayments returns on cancel
//       }
//     Response JSON:
//       { invoiceUrl: string, invoiceId: string }
//
//   GET  {BASE_URL}/api/crypto/order/:orderId
//     Response JSON:
//       { status: "pending" | "paid" | "failed" | "expired", ... }
//
//   POST {BASE_URL}/api/crypto/webhook   (called by NOWPayments — server-side only)
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
  discount?: {
    code: string;
    type: "percent" | "fixed";
    value: number;
    amount: number;
  };
  successUrl: string;
  cancelUrl: string;
};

export type CreateInvoiceResponse = {
  invoiceUrl: string;
  invoiceId: string;
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

export async function getOrderStatus(orderId: string): Promise<{ status: string; [k: string]: unknown }> {
  const base = ensureBaseUrl();
  const res = await fetch(`${base}/api/crypto/order/${encodeURIComponent(orderId)}`);
  if (!res.ok) {
    throw new PaymentsApiError(`Failed to fetch order status (${res.status}).`, res.status);
  }
  return await res.json();
}
