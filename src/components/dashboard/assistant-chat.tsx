"use client";

import { useRef, useState } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Show my stats this month",
  "Find donor Aanya",
  "Who are my lapsed donors?",
  "Export donors to CSV",
  "Draft a campaign 'Roof Fund' goal $20000",
];

export function AssistantChat({ aiEnabled }: { aiEnabled: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? data.error ?? "Something went wrong." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Network error — please try again." }]);
    } finally {
      setPending(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    }
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col rounded-2xl border border-border bg-card shadow-sm">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-gradient text-white shadow-brand">
              <Sparkles className="size-6" />
            </span>
            <div>
              <p className="font-display text-lg font-semibold">Ask about your organization</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                I can search donors, look up receipts, surface lapsed givers and summarize your numbers — for this
                organization only. {aiEnabled ? "" : "(Basic mode — add an AI key for natural conversation.)"}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-secondary/50"
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-border bg-secondary/50 px-4 py-2.5">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about donors, receipts, stats…"
          className="h-11 flex-1 rounded-lg border border-input bg-background px-3.5 text-sm placeholder:text-muted-foreground focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <Button type="submit" size="icon" disabled={pending || !input.trim()} aria-label="Send">
          <Send className="size-[18px]" />
        </Button>
      </form>
    </div>
  );
}
