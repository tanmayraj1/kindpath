import { HeartHandshake } from "lucide-react";

/**
 * Shown in place of a payment form when the organization can't take a payment:
 * it hasn't connected its own merchant account yet, or its stored gateway
 * credentials can't be read.
 *
 * A form that fails at the card step loses the donor's goodwill along with the
 * gift; saying so up front, with a way to give in person, keeps both. The page
 * stays up (the charity may already have printed the QR code), it just doesn't
 * pretend.
 */
export function GivingClosed({
  orgName,
  what = "online donations",
}: {
  orgName: string;
  what?: string;
}) {
  return (
    <div className="w-full max-w-md rounded-card border bg-card p-8 text-center shadow-soft">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <HeartHandshake className="size-6" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">Online giving is opening soon</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {orgName} isn&apos;t accepting {what} here just yet. Thank you for thinking of them — please
        give in person for now, or check back shortly.
      </p>
    </div>
  );
}
