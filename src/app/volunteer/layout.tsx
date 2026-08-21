import { VolunteerShell } from "@/components/shell/volunteer-sidebar";
import { requireVolunteer } from "@/lib/auth/guards";

export default async function VolunteerLayout({ children }: { children: React.ReactNode }) {
  await requireVolunteer();
  return (
    <div className="surface-donor min-h-screen bg-background">
      {/* Surface scope. Re-points the shared design tokens (see globals.css) so
        every existing brand-* class in this subtree resolves to this surface's
        accent, with no per-component edit. */}
      <VolunteerShell>{children}</VolunteerShell>
    </div>
  );
}
