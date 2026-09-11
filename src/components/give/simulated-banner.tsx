import { TriangleAlert } from "lucide-react";
import { isSimulatedProvider } from "@/lib/env";

/**
 * Says, unmissably, that this page is not taking real money.
 *
 * The simulated gateway can run on preview deployments so the donation flow can
 * be demonstrated without a payment provider. A preview URL is still a real URL
 * that can be opened, shared and forwarded, and every other part of this page is
 * designed to look exactly like the real thing — the charity's own logo and
 * colours included. Without this, someone could complete a "donation", receive a
 * receipt-shaped email, and believe they had given money.
 *
 * Renders nothing when a real gateway is configured, so it costs the real
 * donation page nothing.
 */
export function SimulatedGatewayBanner() {
  if (!isSimulatedProvider(process.env.PAYMENT_PROVIDER)) return null;

  return (
    <div
      role="status"
      className="border-b border-warning/40 bg-warning/15 px-4 py-2.5 text-center text-sm text-warning-foreground"
    >
      <span className="inline-flex items-center gap-2">
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">Demonstration only.</span> This page is connected to a
          simulated payment gateway — no card is charged and no money is received.
        </span>
      </span>
    </div>
  );
}
