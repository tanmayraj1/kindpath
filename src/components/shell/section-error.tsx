"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Route-level error boundary body, shared by each portal's error.tsx.
 *
 * Placed inside the route group so the surrounding shell — sidebar, navigation,
 * account menu — stays mounted. The global error.tsx replaced the entire screen,
 * which turned one failing query into "the whole app is gone" and left the user
 * with nowhere to go but the browser back button.
 */
export function SectionError({
  error,
  reset,
  homeHref = "/",
  homeLabel = "Back to dashboard",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
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
    }).catch(() => {
      // Reporting a failure must never itself become a failure.
    });
  }, [error]);

  return (
    <div className="grid flex-1 place-items-center p-6" role="alert">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold">This page didn&apos;t load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong fetching this data. Nothing was changed — your records are
          unaffected. Try again, and if it keeps happening send us the reference below.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">ref: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>
            <RotateCcw className="size-4" aria-hidden />
            Try again
          </Button>
          <Link href={homeHref} className={buttonVariants({ variant: "outline" })}>
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
