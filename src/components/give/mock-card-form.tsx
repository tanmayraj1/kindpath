"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

/** Fake card fields for the simulated gateway page. "Authorize" bounces back to the app. */
export function MockCardForm({
  paymentOrderId,
  redirect,
}: {
  paymentOrderId: string;
  redirect: string;
}) {
  const [busy, setBusy] = useState(false);

  function authorize() {
    setBusy(true);
    // Mirror WeVend's return shape: transactionId carries the cents (stateless mock).
    const cents = paymentOrderId.split("_")[1] ?? "0";
    const transactionId = `mtx_${cents}_${Math.random().toString(36).slice(2, 8)}`;
    const sep = redirect.includes("?") ? "&" : "?";
    window.location.assign(
      `${redirect}${sep}transactionId=${transactionId}&paymentOrderId=${paymentOrderId}&success=1`
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <input
        className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
        placeholder="Card number (any — simulated)"
        defaultValue="4242 4242 4242 4242"
      />
      <div className="grid grid-cols-2 gap-3">
        <input className="h-11 rounded-lg border border-slate-300 px-3 text-sm" placeholder="MM/YY" defaultValue="12/30" />
        <input className="h-11 rounded-lg border border-slate-300 px-3 text-sm" placeholder="CVC" defaultValue="123" />
      </div>
      <button
        onClick={authorize}
        disabled={busy}
        className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {busy && <Loader2 className="size-4 animate-spin" />} Authorize
      </button>
    </div>
  );
}
