import { Minus, Plus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";

export function CartDrawer() {
  const { isOpen, closeCart, items, subtotal, updateQuantity, removeItem, clear } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={(o) => (o ? null : closeCart())}>
      <SheetContent side="right" className="flex w-full flex-col bg-background sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Din varukorg</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">Din varukorg är tom.</p>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-border overflow-y-auto py-4">
              {items.map((item) => (
                <li key={item.slug} className="flex gap-3 py-4">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-20 w-20 shrink-0 rounded-md object-cover"
                  />
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <button
                        onClick={() => removeItem(item.slug)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Ta bort"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-ocean">{item.price} kr</p>
                    <div className="mt-auto flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.slug, item.quantity - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted"
                        aria-label="Minska"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.slug, item.quantity + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted"
                        aria-label="Öka"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-border pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Delsumma</span>
                <span className="text-lg font-bold text-ocean-deep">{subtotal} kr</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Frakt och rabatter beräknas i kassan.
              </p>
              <button className="mt-4 w-full rounded-lg bg-ocean-deep py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-ocean">
                Till kassan
              </button>
              <button
                onClick={clear}
                className="mt-2 w-full rounded-lg py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Töm varukorg
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
