"use client";

import { TEMPLATES } from "@/lib/templates";

export default function TemplatePicker({
  onPick,
  onClose,
}: {
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold text-neutral-100">战术模板</h3>
          <button
            onClick={onClose}
            className="rounded-lg border border-neutral-800 px-3 py-1 text-xs text-neutral-400 transition hover:text-neutral-200"
          >
            关闭
          </button>
        </div>
        <p className="mb-3 text-xs text-neutral-500">
          载入后在球场上自由修改。当前未保存的改动会被覆盖。
        </p>
        <div className="space-y-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              onClick={() => onPick(t.key)}
              className="block w-full rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-left transition hover:border-emerald-700 hover:bg-emerald-500/5"
            >
              <div className="text-sm font-medium text-neutral-100">{t.name}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-neutral-500">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
