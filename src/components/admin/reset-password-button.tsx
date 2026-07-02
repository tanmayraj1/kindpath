"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { resetOrgUserPassword } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [pending, setPending] = useState(false);

  async function onReset() {
    if (!confirm("Reset this admin's password to a temporary one?")) return;
    setPending(true);
    const res = await resetOrgUserPassword(userId);
    setPending(false);
    if (res.tempPassword) {
      alert(`Temporary password: ${res.tempPassword}\nShare it securely; they should change it on next login.`);
    } else if (res.error) {
      alert(res.error);
    }
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={onReset}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
      Reset password
    </Button>
  );
}
