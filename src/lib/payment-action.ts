/**
 * Call a payment-starting server action from the browser without falling over.
 *
 * Server actions are addressed by an id that changes with every deploy. A donor
 * who opened the giving page before a deploy and pressed Continue after it was
 * calling an action that no longer existed: the call threw, nothing caught it,
 * and the page died with "Something went wrong" — mid-gift, with no way forward
 * but a manual reload they had no reason to try. Network drops on a phone at a
 * temple entrance fail the same way.
 *
 * This turns any thrown call into an ordinary `{ ok: false, message }`, and for
 * the stale-deploy case reloads the page once so the donor lands on the current
 * version (their amount is a few taps to re-enter; no money has moved yet).
 */

type Started = { ok: true; redirectTo: string } | { ok: false; message: string };

const RELOAD_KEY = "kp:payment-action-reload";
const RELOAD_WINDOW_MS = 60_000;

function looksStale(e: unknown): boolean {
  const text = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /server action|failed to find|older or newer deployment|unexpected response|404/i.test(text);
}

/** Reload at most once a minute, so a genuinely broken page can't loop forever. */
function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage blocked (private mode): reload anyway — one loop-guard lost is
    // better than a donor stuck on a dead button.
  }
  window.location.reload();
  return true;
}

export async function startPayment<T extends Started>(call: () => Promise<T>): Promise<Started> {
  try {
    return await call();
  } catch (e) {
    if (looksStale(e) && reloadOnce()) {
      return { ok: false, message: "This page was just updated — reloading. Please press Continue again." };
    }
    return {
      ok: false,
      message: "We couldn't reach the payment service. Check your connection and try again.",
    };
  }
}
