import { TOOLS, runTool } from "./tools";
import { formatCAD } from "@/lib/utils";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type AssistantResult = { reply: string; mode: "ai" | "basic" };

const MODEL = process.env.ASSISTANT_MODEL ?? "claude-haiku-4-5-20251001";

function systemPrompt(orgName: string) {
  return `You are KindPath's in-dashboard assistant for "${orgName}", a donation-management platform for community organizations.
Rules:
- Only use the provided tools. They return/affect data for THIS organization only.
- You are mostly read-only: you can search and summarize. You CAN take two safe actions:
  create a DRAFT campaign (a human must publish it) and hand over a CSV export link.
- You CANNOT publish campaigns, send emails, charge cards, edit, or delete anything, and you only
  operate inside this dashboard. If asked to do any of that, politely decline and suggest the page to use.
- Be concise and practical. Format money in CAD.`;
}

/** Full LLM path (Claude tool-use loop). */
async function runWithClaude(orgId: string, orgName: string, messages: ChatMessage[]): Promise<AssistantResult> {
  const key = process.env.ANTHROPIC_API_KEY!;
  const convo: { role: "user" | "assistant"; content: unknown }[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let i = 0; i < 5; i++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: systemPrompt(orgName), tools: TOOLS, messages: convo }),
    });
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      stop_reason?: string;
      error?: { message?: string };
    };
    if (!res.ok) return { reply: `The assistant hit an error (${data.error?.message ?? res.status}).`, mode: "ai" };

    convo.push({ role: "assistant", content: data.content });

    if (data.stop_reason === "tool_use" && data.content) {
      const results = [];
      for (const block of data.content) {
        if (block.type === "tool_use" && block.name) {
          const out = await runTool(orgId, block.name, block.input ?? {});
          results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
        }
      }
      convo.push({ role: "user", content: results });
      continue;
    }
    const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return { reply: text || "I'm not sure how to help with that.", mode: "ai" };
  }
  return { reply: "That took too many steps — please narrow your question.", mode: "ai" };
}

/** No-key deterministic fallback: route to a tool and format the result. */
async function runBasic(orgId: string, message: string): Promise<AssistantResult> {
  const m = message.toLowerCase();
  const strip = (re: RegExp) => message.replace(re, "").trim();

  // --- safe actions first (specific intents) ---
  if (/\bexport\b/.test(m) || /\b(csv|download)\b/.test(m)) {
    const type = /receipt/.test(m) ? "receipts" : /donation|gift/.test(m) ? "donations" : "donors";
    const out = (await runTool(orgId, "export_csv", { type })) as { downloadUrl: string };
    return { reply: `Here's your ${type} CSV: ${out.downloadUrl}\n(Open it while signed in to download.)`, mode: "basic" };
  }
  if (/\b(draft|create|start|set up|new)\b.*\bcampaign\b/.test(m)) {
    const goalMatch = message.match(/\$?\s?([\d,]+(?:\.\d+)?)/);
    const goal = goalMatch ? Number(goalMatch[1].replace(/,/g, "")) : 0;
    if (!goal) {
      return { reply: "Sure — what's the campaign title and goal amount? e.g. \"draft a campaign 'Roof Fund' goal $20000\".", mode: "basic" };
    }
    const titleMatch = message.match(/["'“”]([^"'“”]+)["'“”]/) || message.match(/(?:called|titled|for)\s+(.+?)(?:\s+(?:goal|target|\$|of)\b|$)/i);
    const title = (titleMatch ? titleMatch[1] : "New campaign").trim().slice(0, 80);
    const out = (await runTool(orgId, "create_draft_campaign", { title, goalAmount: goal })) as { manageUrl?: string; error?: string };
    if (out.error) return { reply: out.error, mode: "basic" };
    return { reply: `Created a DRAFT campaign "${title}" with a ${formatCAD(goal)} goal. Review and publish it here: ${out.manageUrl}`, mode: "basic" };
  }

  if (/\b(lapsed|inactive|haven'?t given|re-?engage)\b/.test(m)) {
    const rows = (await runTool(orgId, "lapsed_donors", {})) as { name: string; email: string; lastGift: string }[];
    if (!rows.length) return { reply: "No lapsed donors found — everyone's given recently 🎉", mode: "basic" };
    return { reply: `Lapsed donors (no gift in 6+ months):\n${rows.map((r) => `• ${r.name} (${r.email}) — last gift ${r.lastGift}`).join("\n")}`, mode: "basic" };
  }
  if (/\b(stats?|totals?|how much|raised|summary|overview|numbers?|how many)\b/.test(m)) {
    const s = (await runTool(orgId, "org_stats", {})) as Record<string, number>;
    return {
      reply: `Here's your snapshot:\n• Raised this month: ${formatCAD(s.raisedThisMonth)}\n• Raised this year: ${formatCAD(s.raisedThisYear)}\n• Total donors: ${s.totalDonors}\n• Active recurring plans: ${s.activeRecurringPlans}\n• Active members: ${s.activeMembers}\n• Receipts issued: ${s.receiptsIssued}`,
      mode: "basic",
    };
  }
  if (/\b(receipt|invoice|bill)\b/.test(m)) {
    const q = strip(/\b(find|show|search|me|the|a|receipt|invoice|bill|for|of)\b/gi);
    const rows = (await runTool(orgId, "find_receipts", { query: q })) as { serial: string; donor: string; eligibleAmount: number; status: string; issued: string }[];
    if (!rows.length) return { reply: `No receipts found${q ? ` for "${q}"` : ""}.`, mode: "basic" };
    return { reply: `Receipts:\n${rows.map((r) => `• ${r.serial} — ${r.donor} — ${formatCAD(r.eligibleAmount)} (${r.status}, ${r.issued})`).join("\n")}`, mode: "basic" };
  }
  if (/\b(recent|latest|last)\b/.test(m)) {
    const rows = (await runTool(orgId, "recent_donations", {})) as { donor: string; amount: number; status: string; date: string }[];
    return { reply: `Recent donations:\n${rows.map((r) => `• ${r.date} — ${r.donor} — ${formatCAD(r.amount)} (${r.status})`).join("\n")}`, mode: "basic" };
  }
  if (/\b(find|search|donor|member|who|lookup|email|contact)\b/.test(m)) {
    const q = strip(/\b(find|search|me|the|donor|member|named|called|who is|whois|lookup|for|email|contact|of)\b/gi);
    if (!q) return { reply: "Who should I look up? Try: \"find Aanya\" or \"search michael@example.com\".", mode: "basic" };
    const rows = (await runTool(orgId, "search_donors", { query: q })) as { name: string; email: string; lifetimeGiving: number; addressOnFile: boolean }[];
    if (!rows.length) return { reply: `No donors found matching "${q}".`, mode: "basic" };
    return { reply: `Found ${rows.length}:\n${rows.map((r) => `• ${r.name} (${r.email}) — ${formatCAD(r.lifetimeGiving)} lifetime${r.addressOnFile ? "" : " · address missing"}`).join("\n")}`, mode: "basic" };
  }
  return {
    reply:
      "I can help with your dashboard. Try:\n• \"Find donor Aanya\"\n• \"Show my stats this month\"\n• \"Who are my lapsed donors?\"\n• \"Export donors to CSV\"\n• \"Draft a campaign 'Roof Fund' goal $20000\"\n\n(Connect an AI key to chat more naturally.)",
    mode: "basic",
  };
}

export async function runAssistant(orgId: string, orgName: string, messages: ChatMessage[]): Promise<AssistantResult> {
  const last = messages[messages.length - 1]?.content ?? "";
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await runWithClaude(orgId, orgName, messages);
    } catch {
      return await runBasic(orgId, last);
    }
  }
  return runBasic(orgId, last);
}
