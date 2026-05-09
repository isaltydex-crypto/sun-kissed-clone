import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Package } from "lucide-react";
import { listOrders, updateOrderStatus } from "@/lib/orders.functions";

export const Route = createFileRoute("/admin/ordrar")({
  head: () => ({
    meta: [{ title: "Ordrar — admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  loader: () => listOrders(),
  component: AdminOrdersPage,
});

const PAYMENT = ["pending", "paid", "failed", "refunded"] as const;
const FULFILLMENT = ["new", "processing", "shipped", "delivered", "cancelled"] as const;

function formatKr(ore: number) {
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(ore / 100);
}

function AdminOrdersPage() {
  const data = Route.useLoaderData();
  const router = Route.useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const update = async (
    id: string,
    patch: { paymentStatus?: (typeof PAYMENT)[number]; fulfillmentStatus?: (typeof FULFILLMENT)[number] },
  ) => {
    setBusyId(id);
    try {
      await updateOrderStatus({ data: { id, ...patch } });
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ocean-deep text-primary-foreground">
          <Package className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-ocean-deep">Ordrar</h1>
          <p className="text-sm text-muted-foreground">{data.orders.length} senaste</p>
        </div>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3">Kund</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Betalning</th>
              <th className="px-4 py-3">Leverans</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.orders.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3 font-mono text-xs">
                  <details>
                    <summary className="cursor-pointer text-ocean-deep">{o.order_number}</summary>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {o.order_items?.map((it) => (
                        <li key={it.id}>
                          {it.quantity} × {it.product_name} — {formatKr(it.line_total_ore)}
                        </li>
                      ))}
                    </ul>
                  </details>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(o.created_at).toLocaleString("sv-SE")}
                </td>
                <td className="px-4 py-3">
                  <div>{o.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{o.customer_email}</div>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{formatKr(o.total_ore)}</td>
                <td className="px-4 py-3">
                  <select
                    disabled={busyId === o.id}
                    value={o.payment_status}
                    onChange={(e) => update(o.id, { paymentStatus: e.target.value as (typeof PAYMENT)[number] })}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    {PAYMENT.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    disabled={busyId === o.id}
                    value={o.fulfillment_status}
                    onChange={(e) =>
                      update(o.id, { fulfillmentStatus: e.target.value as (typeof FULFILLMENT)[number] })
                    }
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    {FULFILLMENT.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {data.orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Inga ordrar än.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
