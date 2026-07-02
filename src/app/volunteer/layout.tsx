import { VolunteerShell } from "@/components/shell/volunteer-sidebar";
import { requireVolunteer } from "@/lib/auth/guards";

export default async function VolunteerLayout({ children }: { children: React.ReactNode }) {
  await requireVolunteer();
  return <VolunteerShell>{children}</VolunteerShell>;
}
