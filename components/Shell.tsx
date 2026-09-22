"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Dna, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { TABS, TabId, useApp } from "@/lib/store";
import ActiveCodecChip from "./ActiveCodec";
import Compare from "./tabs/Compare";
import DamageTab from "./tabs/Damage";
import Encode from "./tabs/Encode";
import Evolve from "./tabs/Evolve";
import Loop from "./tabs/Loop";
import Recover from "./tabs/Recover";
import References from "./tabs/References";
import Research from "./tabs/Research";
import { cx } from "./ui";

const VIEWS: Record<TabId, () => React.JSX.Element> = {
  encode: Encode,
  evolve: Evolve,
  loop: Loop,
  damage: DamageTab,
  recover: Recover,
  compare: Compare,
  research: Research,
  refs: References,
};

export default function Shell() {
  const { tab, setTab, running, setRunning, resetGA, ga, evolve } = useApp();

  // The GA runs globally, so the codec keeps evolving no matter which tab is open.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => evolve(1), 450);
    return () => clearInterval(id);
  }, [running, evolve]);

  const View = VIEWS[tab];
  const activeIdx = TABS.findIndex((t) => t.id === tab);

  return (
    <div className="relative z-10 min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/8 backdrop-blur-xl">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(100deg, rgba(49,42,160,0.92), rgba(27,26,94,0.9) 45%, rgba(8,12,22,0.92))",
          }}
        />
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "linear-gradient(140deg,#2dd4a7,#22b8ff)" }}
          >
            <Dna size={20} className="text-black" />
          </motion.div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">DNA CODEC LAB</h1>
              <span className="mono rounded-md bg-white/15 px-1.5 py-0.5 text-[9px] font-bold text-white">
                v3.0
              </span>
            </div>
            <p className="mono text-[10px] text-indigo-200/70">
              Closed-loop GA-optimized genetic storage · simulation model
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="hidden w-[330px] xl:block">
              <ActiveCodecChip compact />
            </div>
            <button
              onClick={() => setRunning(!running)}
              className={cx(
                "mono flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-bold tracking-wider uppercase",
                running
                  ? "bg-amber/20 text-amber ring-1 ring-amber/50"
                  : "bg-teal/15 text-teal ring-1 ring-teal/40",
              )}
              title="Run / pause the genetic algorithm globally"
            >
              {running ? <Pause size={12} /> : <Play size={12} />}
              {running ? "Pause GA" : "Run GA"}
              <span className="text-slate-400">gen {ga.generation}</span>
            </button>
            <button
              onClick={resetGA}
              className="mono flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose/15 px-3 py-2 text-[10px] font-bold tracking-wider text-rose uppercase ring-1 ring-rose/40"
            >
              <RotateCcw size={12} /> Reseed
            </button>
          </div>
        </div>
      </header>

      <nav className="sticky top-[62px] z-20 border-b border-white/5 bg-abyss/85 backdrop-blur-xl">
        <div className="mx-auto max-w-[1500px] overflow-x-auto px-4 py-2.5">
          <div className="flex min-w-max gap-2">
            {TABS.map((t, i) => {
              const active = t.id === tab;
              const done = i < activeIdx;
              return (
                <motion.button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className={cx(
                    "relative flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-current bg-white/5"
                      : "border-white/8 bg-white/2 hover:border-white/20",
                  )}
                  style={{ color: active ? t.accent : undefined }}
                >
                  {active && (
                    <motion.span
                      layoutId="tabglow"
                      className="pointer-events-none absolute inset-0 rounded-xl"
                      style={{ boxShadow: `0 0 0 1px ${t.accent}, 0 8px 28px -14px ${t.accent}` }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span
                    className="mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{
                      background: active ? t.accent : done ? `${t.accent}25` : "rgba(255,255,255,0.06)",
                      color: active ? "#04060c" : done ? t.accent : "#7e8ca6",
                    }}
                  >
                    {done ? <Check size={11} /> : t.n}
                  </span>
                  <span className="leading-tight">
                    <span
                      className="mono block text-[11px] font-bold tracking-wide uppercase"
                      style={{ color: active ? t.accent : "#cbd5e1" }}
                    >
                      {t.label}
                    </span>
                    <span className="mono block text-[9px] text-slate-500">{t.sub}</span>
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[1500px] px-4 py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.24, ease: [0.22, 0.8, 0.28, 1] }}
          >
            <View />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mono border-t border-white/5 px-4 py-6 text-center text-[10px] text-slate-600">
        DNA Codec Lab · closed-loop genetic-algorithm storage simulator · no biological DNA is
        synthesised · every metric on this page is computed in your browser
      </footer>
    </div>
  );
}
