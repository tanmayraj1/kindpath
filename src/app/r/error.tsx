"use client";

import { PaymentError } from "@/components/give/payment-error";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PaymentError {...props} />;
}
