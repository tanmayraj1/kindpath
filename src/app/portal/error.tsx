"use client";

import { SectionError } from "@/components/shell/section-error";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SectionError {...props} homeHref="/portal" homeLabel="Back to my giving" />;
}
