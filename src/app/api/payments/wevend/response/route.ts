import { NextResponse } from "next/server";

/**
 * Terminus for WeVend's mandatory `redirectUrl` on server-to-server calls.
 *
 * Refunds and sale-with-token charges require a redirectUrl even though they
 * return synchronously and never send a browser anywhere. The field still has to
 * be one of our own URLs, so it points here rather than at the gateway's origin.
 *
 * Nothing is recorded here. Donor-facing hosted sales return to
 * /give/[slug]/response, which is where confirmation and receipting actually run.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { ok: true, note: "Server-to-server callback target. No action taken." },
    { status: 200 }
  );
}

export const POST = GET;
