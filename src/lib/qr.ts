import QRCode from "qrcode";
import { BRAND_HEX } from "@/lib/brand";
import { appUrl as deploymentUrl } from "@/lib/app-url";

/** The public giving page for an org. Absolute, so it is safe in a QR code or an email. */
export function givingPageUrl(slug: string): string {
  const appUrl = deploymentUrl();
  return `${appUrl}/give/${slug}`;
}

/**
 * QR for the giving page, as a data URL ready for <img src>.
 *
 * One generator rather than an inline toDataURL per page: the giving page and
 * the onboarding done screen must produce the *same* image — a charity that
 * downloads one from each and gets two different-looking codes will assume one
 * is wrong.
 */
export async function givingPageQr(slug: string): Promise<{ url: string; dataUrl: string }> {
  const url = givingPageUrl(slug);
  const dataUrl = await QRCode.toDataURL(url, {
    width: 640,
    margin: 1,
    color: { dark: BRAND_HEX, light: "#ffffff" },
  });
  return { url, dataUrl };
}
