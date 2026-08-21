import { DonorShell } from "@/components/shell/donor-sidebar";
import { requireDonor } from "@/lib/auth/guards";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireDonor();
  return (
    <div className="surface-donor min-h-screen bg-background">
      {/* Surface scope. Re-points the shared design tokens (see globals.css) so
        every existing brand-* class in this subtree resolves to this surface's
        accent, with no per-component edit. */}
      <DonorShell>{children}</DonorShell>
    </div>
  );
}
