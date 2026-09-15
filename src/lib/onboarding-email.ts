import { sendEmailWithRetry, emailLayout, escapeHtml } from "@/lib/email";
import { captureError } from "@/lib/observability";
import { givingPageUrl } from "@/lib/qr";
import { appUrl as deploymentUrl } from "@/lib/app-url";

/**
 * "You're set up" — sent once, to the admin who finished onboarding.
 *
 * The done screen shows the same facts, but a screen is gone the moment the
 * admin clicks away, and the giving link is the thing they will want to paste
 * into a bulletin next week. The email is also where an admin who skipped the
 * gateway is reminded, in writing, that the page takes no payments yet.
 *
 * Never throws: finishing setup must not fail because a mail provider is down.
 */
export async function sendOnboardingCompleteEmail(args: {
  to: string;
  name: string;
  orgName: string;
  slug: string;
  gatewayConnected: boolean;
  orgId: string;
}): Promise<boolean> {
  const giving = givingPageUrl(args.slug);
  const dashboard = `${deploymentUrl()}/dashboard`;
  const first = escapeHtml(args.name.split(" ")[0] ?? "");
  const org = escapeHtml(args.orgName);

  const payments = args.gatewayConnected
    ? `<p><strong>Payments are connected.</strong> Gifts made on your giving page settle directly to
       your WeVend merchant account — KindPath never holds them.</p>`
    : `<p><strong>One step left: connect payments.</strong> Your giving page is live, but until your
       WeVend merchant account is connected it tells donors online giving is opening soon and takes
       no payments. When WeVend sends your Merchant ID and Terminal ID, enter them under
       <em>Settings → Payments</em>.</p>`;

  try {
    const result = await sendEmailWithRetry({
      to: args.to,
      subject: `${args.orgName} is set up on KindPath`,
      html: emailLayout({
        heading: `You're set up, ${first}`,
        body: `
          <p>${org} is ready on KindPath. Here's your giving page — share it on your website, in
          bulletins and on socials:</p>
          <p style="margin:16px 0"><a href="${giving}" style="font-weight:600;word-break:break-all">${escapeHtml(giving)}</a></p>
          ${payments}
          <p style="margin-top:16px"><strong>Next steps</strong></p>
          <ul style="padding-left:18px;margin:8px 0">
            <li>Download your QR code under <em>Giving page &amp; QR</em> for pews and entrances.</li>
            <li>Invite your team under <em>Team</em> — staff can't change where money goes.</li>
            <li>Turn on two-factor authentication under <em>Security</em>.</li>
          </ul>`,
        ctas: [
          { label: "Open my dashboard", url: dashboard },
          { label: "View my giving page", url: giving },
        ],
      }),
    });
    if (!result.ok) {
      captureError(new Error(result.error), { source: "onboarding.completeEmail", orgId: args.orgId });
    }
    return result.ok;
  } catch (e) {
    captureError(e, { source: "onboarding.completeEmail", orgId: args.orgId });
    return false;
  }
}
