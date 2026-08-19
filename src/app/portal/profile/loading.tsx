import { FormSkeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading UI. Next renders this the instant navigation starts, so
 * the shell and layout stay put and only the data-dependent region shimmers —
 * rather than the page hanging on the previous screen with no feedback.
 */
export default function Loading() {
  return <FormSkeleton panels={2} fields={5} label="Loading your profile" />;
}
