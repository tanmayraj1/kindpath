"use client";

import { useTransition } from "react";
import { UserCog, ShieldOff, ShieldCheck, Loader2 } from "lucide-react";
import { impersonateOrg, grantAccess, revokeAccess } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function OrgQuickActions({ orgId, status }: { orgId: string; status: string }) {
  const [pending, start] = useTransition();
  const active = status === "active";

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => start(() => impersonateOrg(orgId))}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <UserCog className="size-4" />}
        Open as admin
      </Button>
      {active ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          className="border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={() => {
            if (confirm("Revoke access? The org's admins will be locked out and the subscription cancelled."))
              start(() => revokeAccess(orgId));
          }}
        >
          <ShieldOff className="size-4" /> Revoke access
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          className="border-success/30 text-success hover:bg-success/10"
          onClick={() => start(() => grantAccess(orgId))}
        >
          <ShieldCheck className="size-4" /> Grant access
        </Button>
      )}
    </div>
  );
}
