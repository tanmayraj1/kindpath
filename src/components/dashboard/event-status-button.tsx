"use client";

import { useTransition } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { setEventStatus } from "@/app/(dashboard)/dashboard/actions";
import { Button } from "@/components/ui/button";

export function EventStatusButton({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const published = status === "published";
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => start(() => setEventStatus(id, published ? "closed" : "published"))}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : published ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      {published ? "Close event" : "Publish"}
    </Button>
  );
}
