"use client";

import { useTransition } from "react";
import { UserCog, Ban, RotateCcw, Loader2 } from "lucide-react";
import { setOrgStatus, impersonateOrg } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function OrgActions({ orgId, status }: { orgId: string; status: string }) {
  const [pending, start] = useTransition();

  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => start(() => impersonateOrg(orgId))}
        title="Sign in as this org's admin"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <UserCog className="size-4" />}
        Impersonate
      </Button>
      {status === "active" ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-destructive hover:bg-destructive/10"
          onClick={() => start(() => setOrgStatus(orgId, "suspended"))}
        >
          <Ban className="size-4" /> Suspend
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-success hover:bg-success/10"
          onClick={() => start(() => setOrgStatus(orgId, "active"))}
        >
          <RotateCcw className="size-4" /> Activate
        </Button>
      )}
    </div>
  );
}
