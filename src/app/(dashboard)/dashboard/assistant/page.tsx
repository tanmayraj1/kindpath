import { Topbar } from "@/components/dashboard/topbar";
import { Badge } from "@/components/ui/badge";
import { AssistantChat } from "@/components/dashboard/assistant-chat";
import { requireOrgUser } from "@/lib/auth/guards";
import { assertFeature } from "@/lib/access";

export const metadata = { title: "AI assistant" };

export default async function AssistantPage() {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "assistant");
  const aiEnabled = !!process.env.ANTHROPIC_API_KEY;

  return (
    <>
      <Topbar
        title="AI assistant"
        user={{ name: session.name, email: session.email }}
        action={
          <Badge variant={aiEnabled ? "success" : "neutral"}>
            {aiEnabled ? "AI connected" : "Basic mode"}
          </Badge>
        }
      />
      <main className="p-6">
        <AssistantChat aiEnabled={aiEnabled} />
      </main>
    </>
  );
}
