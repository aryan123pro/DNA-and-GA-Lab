"use client";

import Link from "next/link";
import { ReactNode, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { MODELS, ModelMeta } from "@/lib/models";
import { useSteps } from "@/lib/nav";
import { cx } from "./ui";

/**
 * The navigation used to live in a bar across the top of every page. It now
 * lives in the app shell's rail, so this is kept only so older imports still
 * compile.
 */
export function TopBar(props: { current?: ModelMeta["id"] }) {
  void props;
  return null;
}

/**
 * A chapter of the lab. The steps are a sequencer that sticks to the top of the
 * page: click any step, use [ and ], or pick one from the rail or ⌘K — they
 * all drive the same state, and the address bar remembers where you were.
 */
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
  const idx = Number(step);
  const count = model.steps.length;
  const next = MODELS[model.num % MODELS.length];
  const barRef = useRef<HTMLDivElement>(null);
  const onStepRef = useRef(onStep);
  useEffect(() => {
    onStepRef.current = onStep;
  }, [onStep]);

  /** move to a step and bring the sequencer back into view if you had scrolled past it */
  const goRef = useRef((s: number) => {
    const clamped = Math.max(0, Math.min(count - 1, s));
    onStepRef.current(String(clamped));
    const bar = barRef.current;
    if (bar && bar.getBoundingClientRect().top <= 1) {
      const top =
        bar.getBoundingClientRect().top + window.scrollY - (window.innerWidth < 1024 ? 53 : 0);
      window.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
    }
  });

  // a step asked for before this page existed (⌘K), or one in the address bar
  useEffect(() => {
    const pending = useSteps.getState().take(model.id);
    const fromUrl = Number(new URLSearchParams(window.location.search).get("step"));
    const want = pending ?? (fromUrl >= 1 ? fromUrl - 1 : null);
    if (want !== null && want !== idx && want < count) onStepRef.current(String(want));
    // only on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.id]);

  // tell the rail and the palette where we are
  useEffect(() => {
    useSteps.getState().register(model.id, idx, count, (s) => goRef.current(s));
    const url = new URL(window.location.href);
    url.searchParams.set("step", String(idx + 1));
    window.history.replaceState(window.history.state, "", url);
  }, [model.id, idx, count]);
  useEffect(() => () => useSteps.getState().clear(model.id), [model.id]);

  // [ and ] step through the chapter
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      if (e.key === "]") goRef.current(idx + 1);
      if (e.key === "[") goRef.current(idx - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [idx]);

  const progress = count > 1 ? idx / (count - 1) : 1;

  return (
    <div className="min-h-screen">
      {/* ---- the chapter opener ------------------------------------------- */}
      <header className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(70% 120% at 100% 0%, ${model.soft} 0%, transparent 70%)`,
          }}
        />
        {/* the strand running behind the title */}
        <svg
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 h-full w-[55%] opacity-[0.22]"
          viewBox="0 0 400 200"
          preserveAspectRatio="none"
        >
          {[0, Math.PI].map((ph) => (
            <path
              key={ph}
              d={Array.from({ length: 41 }, (_, i) => {
                const x = i * 10;
                const y = 100 + Math.sin(i * 0.42 + ph) * 60;
                return `${i ? "L" : "M"}${x},${y.toFixed(1)}`;
              }).join(" ")}
              fill="none"
              stroke={model.accent}
              strokeWidth="1.4"
            />
          ))}
          {Array.from({ length: 20 }, (_, i) => {
            const x = i * 20 + 5;
            const a = 100 + Math.sin((x / 10) * 0.42) * 60;
            const b = 100 + Math.sin((x / 10) * 0.42 + Math.PI) * 60;
            return (
              <line
                key={i}
                x1={x}
                x2={x}
                y1={a}
                y2={b}
                stroke={model.accent}
                strokeWidth="1"
                opacity="0.6"
              />
            );
          })}
        </svg>

        <div className="relative mx-auto grid max-w-[1120px] items-end gap-x-8 gap-y-3 px-6 pt-10 pb-9 md:grid-cols-[auto_minmax(0,1fr)]">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="font-display text-[96px] leading-[0.8] font-semibold select-none sm:text-[136px]"
            style={{ color: "transparent", WebkitTextStroke: `1.5px ${model.accent}` }}
            aria-hidden
          >
            0{model.num}
          </motion.div>
          <div className="max-w-2xl">
            <div
              className="mono text-[11px] font-bold tracking-[0.18em] uppercase"
              style={{ color: model.accent }}
            >
              Chapter {model.num} of {MODELS.length}
            </div>
            <h1 className="mt-1 text-[34px] leading-[1.02] font-semibold text-ink sm:text-[46px]">
              {model.name}
            </h1>
            <p className="mt-2 text-[16px] font-medium text-ink-2">{model.tagline}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-3">{model.blurb}</p>
          </div>
        </div>
      </header>

      {/* ---- the sequencer ----------------------------------------------------- */}
      <div
        ref={barRef}
        className="sticky top-[53px] z-30 border-b border-line bg-paper/88 backdrop-blur-md lg:top-0"
      >
        <div className="mx-auto flex max-w-[1120px] items-center gap-3 px-6 py-2.5">
          <span
            className="mono hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold sm:flex"
            style={{ background: model.soft, color: model.accent }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: model.accent }} />
            MODEL {model.num}
          </span>

          <ol className="flex min-w-0 flex-1 items-center overflow-x-auto">
            {model.steps.map((s, i) => {
              const cur = i === idx;
              const done = i < idx;
              return (
                <li key={s} className="flex shrink-0 items-center">
                  {i > 0 && (
                    <span
                      aria-hidden
                      className="mx-1 h-[2px] w-5 rounded-full sm:w-8"
                      style={{ background: i <= idx ? model.accent : "var(--color-line)" }}
                    />
                  )}
                  <button
                    onClick={() => goRef.current(i)}
                    aria-current={cur ? "step" : undefined}
                    className={cx(
                      "flex cursor-pointer items-center gap-2 rounded-full py-1 pr-3 pl-1 text-[13px] font-medium whitespace-nowrap transition-colors",
                      cur
                        ? "text-white"
                        : done
                          ? "text-ink-2 hover:bg-sunken"
                          : "text-ink-3 hover:bg-sunken hover:text-ink-2",
                    )}
                    style={cur ? { background: model.accent } : undefined}
                  >
                    <span
                      className="mono flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{
                        background: cur
                          ? "rgba(255,255,255,0.25)"
                          : done
                            ? model.accent
                            : "var(--color-line)",
                        color: cur || done ? "#fff" : "var(--color-ink-3)",
                      }}
                    >
                      {done ? <Check size={11} strokeWidth={3} /> : i + 1}
                    </span>
                    {s}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="flex shrink-0 items-center gap-1">
            <kbd className="mono mr-1 hidden rounded-md border border-line bg-surface px-1.5 py-[1px] text-[10px] text-ink-3 xl:block">
              [ ]
            </kbd>
            <button
              onClick={() => goRef.current(idx - 1)}
              disabled={idx === 0}
              className="cursor-pointer rounded-lg border border-line bg-surface p-1.5 text-ink-2 hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Previous step"
            >
              <ArrowLeft size={15} />
            </button>
            <button
              onClick={() => goRef.current(idx + 1)}
              disabled={idx === count - 1}
              className="cursor-pointer rounded-lg p-1.5 text-white disabled:cursor-not-allowed disabled:opacity-35"
              style={{ background: model.accent }}
              aria-label="Next step"
            >
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
        {/* how far through the chapter you are */}
        <div className="h-[2px] w-full bg-transparent">
          <motion.div
            className="h-full"
            style={{ background: model.accent }}
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 24 }}
          />
        </div>
      </div>

      <main className="mx-auto max-w-[1120px] px-6 py-8">{children}</main>

      {/* ---- what comes next ---------------------------------------------- */}
      <div className="mx-auto max-w-[1120px] px-6 pb-12">
        {idx < count - 1 ? (
          <button
            onClick={() => goRef.current(idx + 1)}
            className="group relative flex w-full cursor-pointer items-center gap-5 overflow-hidden rounded-2xl border border-line bg-surface px-6 py-5 text-left transition-shadow hover:shadow-[0_18px_50px_-28px_rgba(20,25,31,0.45)]"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1.5"
              style={{ background: model.accent }}
            />
            <span className="min-w-0 flex-1">
              <span className="mono block text-[10.5px] font-bold tracking-[0.18em] text-ink-3 uppercase">
                Next · step {idx + 2} of {count}
              </span>
              <span className="font-display mt-1 block text-[24px] leading-tight font-semibold text-ink sm:text-[30px]">
                {model.steps[idx + 1]}
              </span>
            </span>
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition-transform group-hover:translate-x-1"
              style={{ background: model.accent }}
            >
              <ArrowRight size={20} />
            </span>
          </button>
        ) : (
          <Link
            href={next.href}
            className="group relative flex w-full items-center gap-5 overflow-hidden rounded-2xl px-6 py-6 text-white transition-shadow hover:shadow-[0_22px_60px_-28px_rgba(20,25,31,0.6)]"
            style={{ background: `linear-gradient(120deg, ${next.accent}, ${next.accent}cc)` }}
          >
            <span
              aria-hidden
              className="font-display absolute -right-2 -bottom-10 text-[160px] leading-none font-semibold text-white/10"
            >
              0{next.num}
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="mono block text-[10.5px] font-bold tracking-[0.18em] text-white/75 uppercase">
                Chapter complete · up next, model {next.num}
              </span>
              <span className="font-display mt-1 block text-[26px] leading-tight font-semibold sm:text-[34px]">
                {next.name}
              </span>
              <span className="mt-0.5 block text-[14px] text-white/85">{next.tagline}</span>
            </span>
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:translate-x-1">
              <ArrowRight size={20} />
            </span>
          </Link>
        )}
      </div>

      <footer className="border-t border-line py-7">
        <div className="mx-auto max-w-[1120px] px-6 text-[12px] text-ink-3">
          DNA and GA Lab — an educational simulation. No biological DNA is synthesised; every number on
          these pages is computed in your browser.
        </div>
      </footer>
    </div>
  );
}
