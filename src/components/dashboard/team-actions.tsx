"use client";

import { useTransition } from "react";
import { KeyRound, Ban, RotateCcw, Loader2 } from "lucide-react";
import {
  setTeamMemberRole,
  setTeamMemberStatus,
  resetTeamMemberPassword,
} from "@/app/(dashboard)/dashboard/actions";
import { Button } from "@/components/ui/button";

export function TeamActions({
  userId,
  role,
  status,
  isSelf,
}: {
  userId: string;
  role: string;
  status: string;
  isSelf: boolean;
}) {
  const [pending, start] = useTransition();

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">You</span>;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        defaultValue={role}
        disabled={pending}
        onChange={(e) =>
          start(() => setTeamMemberRole(userId, e.target.value as "org_admin" | "signatory" | "staff"))
        }
        className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <option value="org_admin">Admin</option>
        <option value="signatory">Signatory</option>
        <option value="staff">Staff</option>
      </select>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={async () => {
          const res = await resetTeamMemberPassword(userId);
          if (res.tempPassword) alert(`Temporary password: ${res.tempPassword}`);
        }}
      >
        <KeyRound className="size-4" />
      </Button>
      {status === "active" ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-destructive hover:bg-destructive/10"
          onClick={() => start(() => setTeamMemberStatus(userId, "disabled"))}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />} Disable
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-success hover:bg-success/10"
          onClick={() => start(() => setTeamMemberStatus(userId, "active"))}
        >
          <RotateCcw className="size-4" /> Enable
        </Button>
      )}
    </div>
  );
}
