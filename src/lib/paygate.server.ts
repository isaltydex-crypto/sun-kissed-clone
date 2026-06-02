/**
 * PayGate.to server helpers.
 *
 * PayGate is an "open access" hosted credit-card / Apple Pay / Google Pay /
 * SEPA gateway that pays out instantly in USDC (Polygon) to a self-custodial
 * wallet you control. No accounts, no API keys.
 *
 * Flow (per https://documenter.getpostman.com/view/14826208/2sA3Bj9aBi):
 *
 *   1. GET https://api.paygate.to/control/wallet.php
 *          ?address={PAYGATE_WALLET}
 *          &callback={urlencoded callback URL with unique GET param}
 *      → { address_in, polygon_address_in, callback_url, ipn_token }
 *
 *   2. Redirect the customer to either
 *        https://checkout.paygate.to/process-payment.php  (single provider)
 *      or
 *        https://checkout.paygate.to/pay.php              (multi-provider list)
 *      passing address={address_in}, amount, email, currency.
 *
 *   3. When the customer pays, PayGate's bot sends a GET request to your
 *      callback URL with the original parameters + an extra `value_coin`
 *      (USDC amount actually received).
 *
 * There is no HMAC signature on the callback. To prevent spoofing we embed an
 * unguessable token (`t=<PAYGATE_CALLBACK_SECRET>`) in the callback URL itself
 * and verify it on receipt.
 */

export const PAYGATE_WALLET_ENDPOINT = "https://api.paygate.to/control/wallet.php";
export const PAYGATE_CHECKOUT_MULTI = "https://checkout.paygate.to/pay.php";
export const PAYGATE_CHECKOUT_SINGLE = "https://checkout.paygate.to/process-payment.php";

export class PaygateError extends Error {
  status?: number;
  body?: string;
  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export interface CreateWalletInput {
  /** Merchant USDC (Polygon) payout wallet, e.g. 0x… */
  payoutWallet: string;
  /** Full callback URL with a unique GET parameter (e.g. order id). */
  callbackUrl: string;
}

export interface PaygateWallet {
  address_in: string;
  polygon_address_in: string;
  callback_url: string;
  ipn_token: string;
}

export async function createPaygateWallet(input: CreateWalletInput): Promise<PaygateWallet> {
  const url = new URL(PAYGATE_WALLET_ENDPOINT);
  url.searchParams.set("address", input.payoutWallet);
  url.searchParams.set("callback", input.callbackUrl);

  const res = await fetch(url.toString(), { method: "GET" });
  const text = await res.text();
  if (!res.ok) {
    throw new PaygateError(`PayGate wallet.php failed (${res.status})`, res.status, text);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new PaygateError("PayGate wallet.php returned non-JSON", res.status, text);
  }
  const obj = json as Partial<PaygateWallet>;
  if (!obj.address_in || !obj.callback_url) {
    throw new PaygateError("PayGate wallet.php missing fields", res.status, text);
  }
  return obj as PaygateWallet;
}

export interface BuildCheckoutUrlInput {
  addressIn: string;
  amount: number;
  currency: string;
  email: string;
  /** Optional single provider id (moonpay, stripe, transak, …). Omit for multi. */
  provider?: string;
  /** Multi-provider page branding (only applies to pay.php). */
  logoUrl?: string;
  themeColor?: string;
  buttonColor?: string;
  backgroundColor?: string;
}

export function buildPaygateCheckoutUrl(input: BuildCheckoutUrlInput): string {
  const base = input.provider ? PAYGATE_CHECKOUT_SINGLE : PAYGATE_CHECKOUT_MULTI;
  const url = new URL(base);
  url.searchParams.set("address", input.addressIn);
  url.searchParams.set("amount", input.amount.toFixed(2));
  url.searchParams.set("currency", input.currency.toUpperCase());
  url.searchParams.set("email", input.email);
  if (input.provider) url.searchParams.set("provider", input.provider);
  if (input.logoUrl) url.searchParams.set("logo", input.logoUrl);
  if (input.themeColor) url.searchParams.set("theme", input.themeColor);
  if (input.buttonColor) url.searchParams.set("button", input.buttonColor);
  if (input.backgroundColor) url.searchParams.set("background", input.backgroundColor);
  return url.toString();
}
