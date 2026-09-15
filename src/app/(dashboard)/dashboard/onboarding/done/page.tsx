import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Download, ExternalLink, TriangleAlert } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/dashboard/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { requireOrgAdmin } from "@/lib/auth/guards";
import { getOrg } from "@/lib/queries/org";
import { describeOrgGatewayCredentials } from "@/lib/payments/org-credentials";
import { givingPageQr } from "@/lib/qr";
import { wevendEnvironment } from "@/lib/payments/offered";
import { cn } from "@/lib/utils";

export const metadata = { title: "You're set up" };

/**
 * The end of onboarding. Hands the admin the two things they need to start
 * collecting — the giving URL and its QR — and tells them honestly whether a
 * donation made right now would reach them.
 *
 * Reachable after `onboardedAt` is set (the wizard itself redirects here), so a
 * charity can come back for the QR without re-running setup.
 */
export default async function OnboardingDonePage() {
  const session = await requireOrgAdmin();
  const org = await getOrg(session.orgId);
  if (!org) redirect("/dashboard");
  if (!org.onboardedAt) redirect("/dashboard/onboarding");

  const [gateway, qr] = await Promise.all([
    describeOrgGatewayCredentials(session.orgId),
    givingPageQr(org.slug),
  ]);
  const connected = gateway.configured && !gateway.error;
  // "Would a donation made right now move real money?" — Stripe says so per key;
  // WeVend says so per platform host.
  const wevendEnv = wevendEnvironment();
  const testMode =
    connected &&
    (gateway.provider === "stripe" ? !gateway.liveMode : wevendEnv === "sandbox");
  const refundWhere = gateway.provider === "stripe" ? "your Stripe dashboard" : "your WeVend merchant portal";

  return (
    <>
      <Topbar title="Welcome to KindPath" user={{ name: session.name, email: session.email }} />
      <main className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <span className="grid size-11 place-items-center rounded-full bg-success/10 text-success">
                <CheckCircle2 className="size-5" aria-hidden />
              </span>
              <CardTitle className="mt-2">{org.name} is ready</CardTitle>
              <p className="text-sm text-muted-foreground">
                Share this link or the QR code. Anyone can give without an account, and receipts
                are generated automatically.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-2 rounded-input border border-border bg-secondary/50 px-3.5 py-2.5">
                <span className="truncate text-sm font-medium">{qr.url}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={qr.url} />
                <a
                  href={qr.url}
                  target="_blank"
                  rel="noopener"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <ExternalLink className="size-4" aria-hidden /> Open your giving page
                </a>
              </div>
            </CardContent>
          </Card>

          {connected ? (
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle>Send yourself a test donation</CardTitle>
                <p className="text-sm text-muted-foreground">
                  The fastest way to see what a donor sees — including the receipt email.
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {testMode && gateway.provider === "stripe" ? (
                  <p>
                    Your Stripe account is in <span className="font-semibold">test mode</span>, so
                    use the card{" "}
                    <code className="tnum rounded-input bg-secondary px-1.5 py-0.5">4242 4242 4242 4242</code>{" "}
                    with any future expiry and any CVC. No real money moves. When you&apos;re ready
                    to take real donations, swap in your live key under Settings → Payments.
                  </p>
                ) : testMode ? (
                  <p>
                    Your merchant is connected to WeVend&apos;s{" "}
                    <span className="font-semibold">sandbox</span>: use the test card numbers
                    WeVend gave you. No real money moves.
                  </p>
                ) : (
                  <p>
                    Your merchant account is <span className="font-semibold">live</span>: a real
                    card will be charged. Give a small amount and refund it from {refundWhere}{" "}
                    afterwards — the receipt is cancelled when the refund is recorded.
                  </p>
                )}
                <div>
                  <a
                    href={qr.url}
                    target="_blank"
                    rel="noopener"
                    className={buttonVariants({ size: "sm" })}
                  >
                    Make a test donation
                  </a>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex max-w-2xl items-start gap-3 rounded-card border border-warning/30 bg-warning/10 px-4 py-3.5 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden />
              <div className="flex flex-col gap-2">
                <div>
                  <p className="font-semibold">You can&apos;t receive donations yet</p>
                  <p className="text-muted-foreground">
                    Your giving page is live, but until your WeVend merchant account is connected it
                    tells donors online giving is opening soon and takes no payments.
                  </p>
                </div>
                <div>
                  <Link href="/dashboard/settings#payments" className={buttonVariants({ size: "sm" })}>
                    Connect your merchant account
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div>
            <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
              Go to dashboard
            </Link>
          </div>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Your QR code</CardTitle>
            <p className="text-sm text-muted-foreground">
              Print it for pews, entrances and bulletins.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="rounded-card border border-border p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.dataUrl} alt="Donation QR code" width={240} height={240} />
            </div>
            <a
              href={qr.dataUrl}
              download={`kindpath-qr-${org.slug}.png`}
              className={cn(buttonVariants({ size: "sm" }), "w-full")}
            >
              <Download className="size-4" aria-hidden /> Download QR (PNG)
            </a>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
