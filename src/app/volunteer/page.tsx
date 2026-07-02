import QRCode from "qrcode";
import { HeartHandshake } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireVolunteer } from "@/lib/auth/guards";
import { listOwnPasses } from "@/lib/queries/volunteers";
import { signedPassUrl } from "@/lib/pass-links";

export const metadata = { title: "My passes" };

export default async function VolunteerHome() {
  const session = await requireVolunteer();
  const passes = await listOwnPasses(session.orgId, session.sub);

  const withQr = await Promise.all(
    passes.map(async (p) => ({
      ...p,
      qr: await QRCode.toDataURL(signedPassUrl(p.id), { margin: 1, width: 240 }),
    }))
  );

  return (
    <>
      <Topbar title="My passes" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        {withQr.length === 0 ? (
          <EmptyState
            icon={<HeartHandshake className="size-5" />}
            title="No passes yet"
            body="When your organization issues you a pass, it will appear here with its QR code."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {withQr.map((p) => {
              const expired = !!p.validUntil && p.validUntil < new Date();
              const revoked = p.status === "revoked";
              return (
                <Card key={p.id} className={revoked || expired ? "opacity-60" : undefined}>
                  <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
                    <p className="text-xs text-muted-foreground">{p.org.name}</p>
                    <p className="font-display font-bold">{p.title}</p>
                    <Badge variant={revoked ? "destructive" : expired ? "neutral" : "success"}>
                      {revoked ? "Revoked" : expired ? "Expired" : "Active"}
                    </Badge>
                    {/* QR encodes the signed verification URL — show this at the door */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.qr} alt={`QR code for pass ${p.serial}`} className="size-44 rounded-lg border border-border" />
                    <p className="font-mono text-xs text-muted-foreground">{p.serial}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.validUntil
                        ? `Valid until ${new Date(p.validUntil).toLocaleDateString("en-CA")}`
                        : "No expiry"}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
