"use client";

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { runBillingNow } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function RunBillingButton() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setResult(null);
    const s = await runBillingNow();
    setPending(false);
    setResult(
      `Due ${s.due} · charged ${s.charged} · failed ${s.failed} · suspended ${s.suspended} · receipts ${s.receiptsIssued}`
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" size="sm" disabled={pending} onClick={run} className="w-fit">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
        Run billing now
      </Button>
      {result && <p className="text-xs text-muted-foreground">{result}</p>}
    </div>
  );
}
