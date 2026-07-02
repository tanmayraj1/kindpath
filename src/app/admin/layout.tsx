import { AdminShell } from "@/components/shell/admin-sidebar";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  return <AdminShell>{children}</AdminShell>;
}
