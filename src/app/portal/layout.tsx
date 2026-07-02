import { DonorShell } from "@/components/shell/donor-sidebar";
import { requireDonor } from "@/lib/auth/guards";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireDonor();
  return <DonorShell>{children}</DonorShell>;
}
