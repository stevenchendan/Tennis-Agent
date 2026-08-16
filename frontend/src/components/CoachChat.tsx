"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "这场球最重要的战术模式是什么？",
  "P1 的发球应该往哪边发？",
  "如果我对上 P2 这样的球员，该怎么打？",
];

export default function CoachChat({ analysisId }: { analysisId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [llmOn, setLlmOn] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    try {
      const { answer, llm } = await api.chat(analysisId, q);
      setLlmOn(llm);
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `出错了：${e instanceof Error ? e.message : e}` },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      {messages.length === 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 transition hover:border-emerald-500 hover:text-emerald-300"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === "user"
                ? "ml-auto max-w-[85%] bg-emerald-700/30 text-emerald-50"
                : "mr-auto max-w-[85%] bg-neutral-900 text-neutral-200"
            }`}
          >
            {m.content}
          </div>
        ))}
        {busy && <div className="text-sm text-neutral-500">教练思考中…</div>}
        <div ref={bottomRef} />
      </div>
      {llmOn === false && messages.length > 0 && (
        <p className="mt-3 text-xs text-neutral-600">
          当前为规则引擎回答；配置 TENNIS_OPENAI_API_KEY 后由 LLM 生成更深入的解读。
        </p>
      )}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="问点关于这场比赛的战术问题…"
          className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-600"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-40"
        >
          发送
        </button>
      </form>
    </div>
  );
}
