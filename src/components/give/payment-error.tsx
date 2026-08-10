"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Error boundary for the PUBLIC money-handling routes.
 *
 * The generic app error page says "something went wrong", which — on a page
 * where someone has just entered payment details — reads as "my payment failed"
 * and invites a second attempt. The single most important thing to say here is
 * what did and didn't happen to their money.
 */
export function PaymentError({
  error,
  reset,
  homeHref = "/",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
}) {
  useEffect(() => {
    console.error(error);
    void fetch("/api/monitoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        url: window.location.pathname,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center bg-secondary/40 p-6" role="alert">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <Logo className="mx-auto" />
        <span className="mx-auto mt-6 grid size-12 place-items-center rounded-full bg-warning/10 text-warning">
          <ShieldCheck className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold">This page didn&apos;t load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong displaying this page.{" "}
          <strong className="text-foreground">
            If you had already reached a payment confirmation, your payment was not affected —
            please don&apos;t pay again.
          </strong>{" "}
          If you were part-way through, nothing has been charged.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">ref: {error.digest}</p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          If you&apos;re unsure either way, contact the organization before trying again — they can
          see exactly what was received.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link href={homeHref} className={buttonVariants({ variant: "outline" })}>
            Back
          </Link>
        </div>
      </div>
    </div>
  );
}
