import { AdminShell } from "@/components/shell/admin-sidebar";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  return (
    <div className="surface-app min-h-screen bg-background">
      {/* Surface scope. Re-points the shared design tokens (see globals.css) so
        every existing brand-* class in this subtree resolves to this surface's
        accent, with no per-component edit. */}
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
