import { ExternalLink, Download, CreditCard, Smartphone, Tablet } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/dashboard/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { requireOrgUser } from "@/lib/auth/guards";
import { assertFeature } from "@/lib/access";
import { getOrg } from "@/lib/queries/org";
import { cn } from "@/lib/utils";
import { givingPageQr } from "@/lib/qr";
import { appUrl as deploymentUrl } from "@/lib/app-url";

export const metadata = { title: "Giving page & QR" };

export default async function GivingPage() {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "qr");
  const org = await getOrg(session.orgId);
  const slug = org?.slug ?? "";

  const appUrl = deploymentUrl();
  const { url: giveUrl, dataUrl: qrDataUrl } = await givingPageQr(slug);

  return (
    <>
      <Topbar title="Giving page & QR" user={{ name: session.name, email: session.email }} />
      <main className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
        {/* link + how it works */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Your public donation page</CardTitle>
              <p className="text-sm text-muted-foreground">
                Share this link or QR code. Anyone can give without an account — they only need an
                email address, and their receipt arrives by email. Shared links preview with your
                name, logo and colour.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3.5 py-2.5">
                <span className="truncate text-sm font-medium">{giveUrl}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={giveUrl} />
                <a
                  href={giveUrl}
                  target="_blank"
                  rel="noopener"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <ExternalLink className="size-4" /> Open page
                </a>
                <a
                  href={`${giveUrl}?pos=wevend`}
                  target="_blank"
                  rel="noopener"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <CreditCard className="size-4" /> POS (We Vend) mode
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ways to collect donations</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: Smartphone, title: "Scan QR", body: "Print the QR for pews, entrances, and bulletins." },
                { icon: ExternalLink, title: "Share link", body: "Post it on your website, email, and socials." },
                { icon: CreditCard, title: "POS (We Vend)", body: "Take in-person card donations on your We Vend POS terminal." },
              ].map((w) => (
                <div key={w.title} className="flex flex-col gap-2">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <w.icon className="size-5" />
                  </span>
                  <p className="font-medium">{w.title}</p>
                  <p className="text-sm text-muted-foreground">{w.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* QR card */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Your QR code</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="rounded-2xl border border-border p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Donation QR code" width={240} height={240} />
            </div>
            <a
              href={qrDataUrl}
              download={`kindpath-qr-${slug}.png`}
              className={cn(buttonVariants({ size: "sm" }), "w-full")}
            >
              <Download className="size-4" /> Download QR (PNG)
            </a>
          </CardContent>
        </Card>

        {/* Kiosk card */}
        <Card className="h-fit lg:col-start-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tablet className="size-5 text-brand-600" /> Kiosk mode
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Full-screen self-serve giving for a tablet at your entrance or events. Large amount
              buttons, receipts emailed, auto-resets for the next person.
            </p>
          </CardHeader>
          <CardContent>
            <a
              href={`${appUrl}/kiosk/${slug}`}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ size: "sm" }), "w-full")}
            >
              <ExternalLink className="size-4" /> Launch kiosk
            </a>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
