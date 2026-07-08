import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { MockCardForm } from "@/components/give/mock-card-form";

export const metadata = { title: "Secure payment (simulated)", robots: { index: false } };

/**
 * Local stand-in for a hosted gateway's card iframe (WeVend-style). Only served
 * when the mock-hosted provider is active — never in real-gateway configs.
 * Bounces back to the app's redirect URL with a transactionId, exactly like
 * WeVend does: {redirectUrl}?transactionId=…&paymentOrderId=…&success=1
 */
export default function MockGatewayPage({
  params,
  searchParams,
}: {
  params: { paymentOrderId: string };
  searchParams: { redirect?: string };
}) {
  if (process.env.PAYMENT_PROVIDER !== "mock-hosted") notFound();
  const { paymentOrderId } = params;
  const redirect = searchParams.redirect ?? "";
  if (!/^mpo_\d+_/.test(paymentOrderId) || !redirect) notFound();

  const cents = Number(paymentOrderId.split("_")[1] ?? 0);

  return (
    <div className="grid min-h-dvh place-items-center bg-slate-900 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-800">WePay Gateway</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            SIMULATED
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          This is KindPath&apos;s local stand-in for the WeVend hosted card page.
        </p>

        <p className="mt-4 text-2xl font-bold text-slate-900">
          ${(cents / 100).toFixed(2)} <span className="text-sm font-normal text-slate-500">CAD</span>
        </p>

        <MockCardForm paymentOrderId={paymentOrderId} redirect={redirect} />

        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="size-3.5" /> Card details never reach KindPath — they are entered
          on the gateway&apos;s page.
        </p>
      </div>
    </div>
  );
}
