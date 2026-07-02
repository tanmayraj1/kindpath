"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2 } from "lucide-react";
import { generateAnnualReceipts } from "@/app/(dashboard)/dashboard/actions";
import { Button } from "@/components/ui/button";

export function AnnualReceiptsButton({ years }: { years: number[] }) {
  const [year, setYear] = useState(years[0]);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setPending(true);
    setMsg(null);
    const res = await generateAnnualReceipts(year);
    setPending(false);
    if (res.error) setMsg(res.error);
    else {
      setMsg(`Generated ${res.created} receipt${res.created === 1 ? "" : "s"}` + (res.skipped ? `, ${res.skipped} already existed.` : "."));
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <Button variant="outline" size="sm" disabled={pending} onClick={run}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
        Generate annual receipts
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
