import { useEffect, useRef, useState } from "react";
import { useAssistantChat, useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Trash2 } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// The API rejects messages longer than 4000 characters; keep history entries
// under that limit so a long reply never breaks subsequent requests.
const MAX_MESSAGE_CHARS = 4000;

function clip(s: string): string {
  return s.length > MAX_MESSAGE_CHARS ? s.slice(0, MAX_MESSAGE_CHARS) : s;
}

function loadMessages(storageKey: string): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is ChatMessage =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    );
  } catch {
    return [];
  }
}

export default function AssistantChat() {
  const { data: me } = useGetMe();
  // Scope stored conversations to the signed-in user and business so chats
  // never leak across accounts in the same browser tab.
  const storageKey = me?.business
    ? `bda-assistant-chat:${me.user.id}:${me.business.id}`
    : null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const chat = useAssistantChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (storageKey && loadedKeyRef.current !== storageKey) {
      loadedKeyRef.current = storageKey;
      setMessages(loadMessages(storageKey));
    }
  }, [storageKey]);

  useEffect(() => {
    if (storageKey && loadedKeyRef.current === storageKey) {
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify(messages.slice(-30)),
        );
      } catch {
        /* storage full or unavailable — non-fatal */
      }
    }
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, chat.isPending, storageKey]);

  const send = () => {
    const content = clip(input.trim());
    if (!content || chat.isPending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    chat.mutate(
      {
        data: {
          messages: next.slice(-20).map((m) => ({ ...m, content: clip(m.content) })),
        },
      },
      {
        onSuccess: (res) => {
          setMessages((cur) => [
            ...cur,
            { role: "assistant", content: res.reply },
          ]);
        },
        onError: () => {
          setMessages((cur) => [
            ...cur,
            {
              role: "assistant",
              content:
                "Sorry, I couldn't respond just now. Please try again in a moment.",
            },
          ]);
        },
      },
    );
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm" data-testid="assistant-chat">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <span className="flex-1">AI Assistant</span>
          {messages.length > 0 && (
            <button
              type="button"
              title="Clear conversation"
              className="text-slate-400 hover:text-slate-600"
              onClick={() => setMessages([])}
              data-testid="assistant-clear"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </CardTitle>
        <p className="text-xs text-slate-500 pt-1">
          Ask anything about your setup, your agent, or running your business.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={scrollRef}
          className="h-72 overflow-y-auto space-y-2 pr-1"
          data-testid="assistant-messages"
        >
          {messages.length === 0 && (
            <div className="space-y-1.5 pt-2">
              {[
                "What's left to finish my setup?",
                "How do I add the widget to my website?",
                "Are my pricing rules complete?",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="w-full text-left text-xs text-slate-600 border border-slate-200 rounded-md px-2.5 py-2 hover:bg-slate-50"
                  onClick={() => setInput(s)}
                  data-testid="assistant-suggestion"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-6 rounded-lg bg-blue-600 text-white px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap"
                  : "mr-2 rounded-lg bg-slate-100 text-slate-800 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap"
              }
            >
              {m.content}
            </div>
          ))}
          {chat.isPending && (
            <div className="mr-2 rounded-lg bg-slate-100 text-slate-400 px-3 py-2 text-xs">
              Thinking…
            </div>
          )}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask a question…"
            rows={1}
            className="text-xs min-h-[38px] max-h-28 resize-none"
            data-testid="assistant-input"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={chat.isPending || !input.trim()}
            onClick={send}
            data-testid="assistant-send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
