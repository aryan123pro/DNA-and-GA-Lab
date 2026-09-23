"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { MODELS, ModelMeta } from "@/lib/models";
import { StepRail, cx } from "./ui";

function Mark({ accent }: { accent: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 2c0 5 10 5 10 10S7 17 7 22"
        stroke={accent}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M17 2c0 5-10 5-10 10s10 5 10 10"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TopBar({ current }: { current?: ModelMeta["id"] }) {
  const accent = MODELS.find((m) => m.id === current)?.accent ?? "#0d9488";
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1120px] items-center gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <Mark accent={accent} />
          <span className="font-display text-[15px] font-semibold tracking-tight">
            The DNA Lab
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          {MODELS.map((m) => {
            const on = m.id === current;
            return (
              <Link
                key={m.id}
                href={m.href}
                className={cx(
                  "hidden rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:block",
                  on ? "text-white" : "text-ink-2 hover:bg-sunken",
                )}
                style={on ? { background: m.accent } : undefined}
              >
                <span className="mono mr-1.5 text-[11px] opacity-70">{m.num}</span>
                {m.name}
              </Link>
            );
          })}
          <Link
            href="/references"
            className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-sunken"
          >
            Sources
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function ModelShell({
  model,
  step,
  onStep,
  children,
}: {
  model: ModelMeta;
  step: string;
  onStep: (id: string) => void;
  children: ReactNode;
}) {
  const steps = model.steps.map((label, i) => ({ id: String(i), label }));
  const idx = Number(step);
  const next = MODELS[model.num % MODELS.length];

  return (
    <div className="min-h-screen">
      <TopBar current={model.id} />

      <div className="border-b border-line" style={{ background: model.soft }}>
        <div className="mx-auto max-w-[1120px] px-5 py-8">
          <Link
            href="/"
            className="mono inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.1em] text-ink-2 uppercase hover:text-ink"
          >
            <ArrowLeft size={12} /> All three models
          </Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <div className="mono text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: model.accent }}>
                Model {model.num}
              </div>
              <h1 className="mt-1 text-[30px] leading-[1.1] font-semibold text-ink sm:text-[38px]">
                {model.name}
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{model.tagline}</p>
            </div>
          </div>
          <div className="mt-6">
            <StepRail steps={steps} active={step} onSelect={onStep} accent={model.accent} />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1120px] px-5 py-8">{children}</main>

      <div className="mx-auto max-w-[1120px] px-5 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <div className="flex gap-2">
            {idx > 0 && (
              <button
                onClick={() => onStep(String(idx - 1))}
                className="cursor-pointer rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:bg-sunken"
              >
                ← {model.steps[idx - 1]}
              </button>
            )}
            {idx < steps.length - 1 && (
              <button
                onClick={() => onStep(String(idx + 1))}
                className="cursor-pointer rounded-lg px-3.5 py-2 text-[13px] font-medium text-white"
                style={{ background: model.accent }}
              >
                {model.steps[idx + 1]} →
              </button>
            )}
          </div>
          <Link
            href={next.href}
            className="group inline-flex items-center gap-2 text-[13.5px] font-medium text-ink-2 hover:text-ink"
          >
            Next up — Model {next.num}: {next.name}
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <footer className="border-t border-line py-7">
        <div className="mx-auto max-w-[1120px] px-5 text-[12px] text-ink-3">
          The DNA Lab — an educational simulation. No biological DNA is synthesised; every
          number on these pages is computed in your browser.
        </div>
      </footer>
    </div>
  );
}
