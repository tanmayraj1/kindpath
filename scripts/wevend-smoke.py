#!/usr/bin/env python3
"""
WeVend smoke test — talks to WeVend directly, with KindPath out of the loop.

When a payment fails on WeVend's card page ("Code 500"), the question is always
whether it's our integration or the merchant's set-up. This runs the exact calls
KindPath makes (organization login → sale → card page → transaction lookup) and
prints what WeVend needs to look the failure up in their logs.

    python3 scripts/wevend-smoke.py

Passwords are read with getpass (never echoed) and nothing is written to disk.
No receipt or donation is recorded anywhere — this is outside KindPath entirely.
In production a real card IS charged: use a small amount and refund it in WeCenter.
"""
import getpass
import json
import time
import urllib.error
import urllib.parse
import urllib.request

ENVS = {
    "sandbox": "https://wepay.wevend.dev",
    "production": "https://wepay.wevend.pro",
}
IFRAMES = {
    "sandbox": {"CA": "https://iframe.wevend.dev", "US": "https://iframe-us.wevend.dev"},
    "production": {"CA": "https://iframe.wevend.pro", "US": "https://iframe-us.wevend.pro"},
}
# A real URL of ours that ends in /response, as WeVend requires. It records nothing.
REDIRECT = "https://www.kind-path.org/api/payments/wevend/response"


def call(method, url, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except ValueError:
            return e.code, {}


def ask(prompt, default=None):
    v = input(f"{prompt}{f' [{default}]' if default else ''}: ").strip()
    return v or (default or "")


def main():
    env = ask("Environment (sandbox / production)", "sandbox")
    if env not in ENVS:
        raise SystemExit("Choose sandbox or production.")
    base = ENVS[env]
    wv = ask("Organization WV number", "WV-ISV-50001" if env == "sandbox" else "WV-RP-5010")
    pw = getpass.getpass("Organization password (hidden): ")
    mid = ask("Merchant ID (MID)")
    tid = ask("Terminal ID (TID)")
    amount = ask("Amount in dollars", "1.00")
    cents = str(round(float(amount) * 100))

    print("\n1. Organization login …")
    status, body = call("POST", f"{base}/api/auth/org-token", {"wvNumber": wv, "password": pw})
    pw = None  # not needed again
    token = (body.get("data") or {}).get("accessToken")
    if not token:
        raise SystemExit(f"   FAILED ({status}): {body.get('message')}")
    print("   ok")

    order_id = f"kpsm{int(time.time()) % 10**10}"[:15]
    print("2. Creating sale …")
    status, body = call(
        "POST",
        f"{base}/api/payments/sale",
        {"amount": cents, "orderId": order_id, "mid": mid, "termId": tid, "redirectUrl": REDIRECT},
        token,
    )
    po = (body.get("data") or {}).get("paymentOrderId")
    if not body.get("success") or not po:
        raise SystemExit(f"   FAILED ({status}): {body.get('message')}  {json.dumps(body.get('data'))}")
    print(f"   ok — paymentOrderId {po}")

    print("\n3. Open ONE of these on your phone or computer and pay:")
    for region, host in IFRAMES[env].items():
        print(f"   {region}: {host}/{po}/carNew")
    if env == "sandbox":
        print("   Sandbox test card: 4111 1111 1111 1111, any future expiry, any CVV.")
    else:
        print("   PRODUCTION — a real card is charged. Refund it in WeCenter afterwards.")
    print("   After paying (or failing), copy the transactionId from the address bar")
    print("   of the page you land on (…/response?transactionId=…).")

    txn = ask("\n4. transactionId (blank to skip)")
    if txn:
        status, body = call(
            "GET",
            f"{base}/api/payments/get-transaction/{urllib.parse.quote(txn)}?mid={urllib.parse.quote(mid)}",
            token=token,
        )
        d = body.get("data") or {}
        print(f"   lookup {status}: success={body.get('success')} respCode={d.get('respCode')} "
              f"detail={d.get('detailRespData')!r} amount={d.get('amount')} "
              f"paymentOrderId={d.get('paymentOrderId')}")

    print("\n— Send this block to WeVend —")
    print(f"environment: {env}   organization: {wv}")
    print(f"MID: {mid}   TID: {tid}   amount: {cents} cents   orderId: {order_id}")
    print(f"paymentOrderId: {po}")
    if txn:
        print(f"transactionId: {txn}")
    print(f"time: {time.strftime('%Y-%m-%d %H:%M:%S %Z')}")


if __name__ == "__main__":
    main()
