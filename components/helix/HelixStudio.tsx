"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Bug,
  LocateFixed,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Flame,
  Pause,
  Play,
  RotateCcw,
  ScissorsLineDashed,
  Sun,
  Wrench,
  Zap,
} from "lucide-react";
import { scaleLinear } from "d3-scale";
import { line as d3line, curveMonotoneX } from "d3-shape";
import {
  COMPLEMENT,
  Helix,
  LESION_INFO,
  LesionKind,
  PATHWAY_INFO,
  PathwayId,
  buildHelix,
  damage,
  findLesions,
  readBase,
  readWord,
  startRepair,
  tick,
} from "@/lib/helix";
import { BASE_HEX, Pick, RenderMemory, View, drawHelix, makeMemory } from "./renderHelix";
import { cx } from "@/components/ui";

const ACCENT = "#0d9488";
const PRESETS = ["LIFE", "DNA", "HELLO", "CELL"];
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3.2;
const ZOOM_STEP = 1.25;

/** The word to start with: ?word= from the address bar (the home page links here with yours). */
function initialWord() {
  if (typeof window === "undefined") return "LIFE";
  const w = new URLSearchParams(window.location.search).get("word") ?? "";
  const clean = w
    .toUpperCase()
    .replace(/[^A-Z !?]/g, "")
    .slice(0, 8);
  return clean || "LIFE";
}

type Tool = LesionKind | "repair";

const TOOLS: { id: Tool; label: string; hint: string; icon: typeof Flame }[] = [
  { id: "oxo", label: "Oxidise", hint: "reactive oxygen", icon: Flame },
  { id: "mismatch", label: "Typo", hint: "copying error", icon: Bug },
  { id: "abasic", label: "Knock off", hint: "lost base", icon: ScissorsLineDashed },
  { id: "dimer", label: "UV light", hint: "welds two bases", icon: Sun },
  { id: "break", label: "Radiation", hint: "snaps both strands", icon: Zap },
];

function toolColor(t: Tool) {
  return t === "repair" ? "#4ade80" : LESION_INFO[t].color;
}

/* -------------------------------------------------------------------------- */
/* what React sees of the simulation, ten times a second                      */
/* -------------------------------------------------------------------------- */

interface JobView {
  id: number;
  pathway: PathwayId;
  step: number;
  steps: { title: string }[];
  frac: number;
  caption: string;
  enzyme: string;
  enzymeRole: string;
  color: string;
  done: boolean;
  exact: boolean;
}

interface Snap {
  t: number;
  sites: {
    id: number;
    letter: string;
    partner: string;
    read: string | null;
    present: boolean;
    state: "ok" | "oxo" | "dimer" | "mismatch" | "abasic" | "mutated" | "fresh" | "gone";
  }[];
  readout: ReturnType<typeof readWord>;
  stats: Helix["stats"];
  jobs: JobView[];
  latest: JobView | null;
  waiting: number;
  fork: number;
  breakOpen: boolean;
}

function snapshot(h: Helix): Snap {
  const jobs: JobView[] = h.jobs.map((j) => {
    const st = j.steps[Math.min(j.step, j.steps.length - 1)];
    return {
      id: j.id,
      pathway: j.pathway,
      step: j.step,
      steps: j.steps.map((s) => ({ title: s.title })),
      frac: j.done ? 1 : Math.min(1, j.stepT / st.duration),
      caption: st.caption,
      enzyme: st.enzyme?.name ?? "",
      enzymeRole: st.enzyme?.role ?? "",
      color: st.enzyme?.color ?? PATHWAY_INFO[j.pathway].color,
      done: j.done,
      exact: j.exact,
    };
  });
  const active = jobs.filter((j) => !j.done);
  return {
    t: h.t,
    sites: h.sites.map((s) => ({
      id: s.id,
      letter: s.letter,
      partner: COMPLEMENT[s.truth],
      read: readBase(s),
      present: s.present,
      state: s.gone
        ? "gone"
        : !s.present
          ? "abasic"
          : s.lesion === "oxo"
            ? "oxo"
            : s.lesion === "dimer"
              ? "dimer"
              : s.letter !== s.truth
                ? "mismatch"
                : s.permanent
                  ? "mutated"
                  : h.t - s.fresh < 1.5
                    ? "fresh"
                    : "ok",
    })),
    readout: readWord(h),
    stats: { ...h.stats },
    jobs: active,
    latest: active[active.length - 1] ?? jobs[jobs.length - 1] ?? null,
    waiting: findLesions(h).length,
    fork: h.fork,
    breakOpen: h.breakAfter !== null,
  };
}

/* -------------------------------------------------------------------------- */

function Sparkline({ data, color, max = 1 }: { data: number[]; color: string; max?: number }) {
  const W = 220;
  const H = 40;
  const x = scaleLinear()
    .domain([0, Math.max(30, data.length - 1)])
    .range([2, W - 2]);
  const y = scaleLinear()
    .domain([0, max])
    .range([H - 3, 3]);
  const path =
    d3line<number>()
      .x((_, i) => x(i))
      .y((d) => y(d))
      .curve(curveMonotoneX)(data) ?? "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-10 w-full" preserveAspectRatio="none">
      <line x1={2} y1={y(max)} x2={W - 2} y2={y(max)} stroke="#2a3644" strokeDasharray="3 3" />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      title={hint}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[12px] text-slate-300 hover:bg-white/5"
    >
      <span
        className={cx(
          "relative h-[18px] w-8 shrink-0 rounded-full transition-colors",
          on ? "bg-teal-500" : "bg-white/15",
        )}
      >
        <span
          className={cx(
            "absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-[left]",
            on ? "left-[16px]" : "left-[2px]",
          )}
        />
      </span>
      {label}
    </button>
  );
}

const STATE_STYLE: Record<Snap["sites"][number]["state"], { ring: string; label: string }> = {
  ok: { ring: "transparent", label: "" },
  fresh: { ring: "#67e8f9", label: "just rewritten" },
  oxo: { ring: "#f43f5e", label: "oxidised" },
  dimer: { ring: "#a855f7", label: "UV dimer" },
  mismatch: { ring: "#fb923c", label: "mismatch" },
  abasic: { ring: "#facc15", label: "empty seat" },
  mutated: { ring: "#f87171", label: "permanent mutation" },
  gone: { ring: "#64748b", label: "being trimmed" },
};

/** A big, touch-friendly button for the zoom controls. */
function ZoomButton({
  label,
  big,
  disabled,
  onClick,
  children,
}: {
  label: string;
  big: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cx(
        "flex cursor-pointer items-center justify-center rounded-xl text-slate-100 transition-colors hover:bg-white/10 active:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30",
        big ? "h-14 w-14" : "h-10 w-10",
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */

export default function HelixStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // read once per visit, so arriving from the home page with a new word works
  const [start] = useState(initialWord);
  const helixRef = useRef<Helix>(buildHelix(start));
  const memRef = useRef<RenderMemory | null>(null);
  const viewRef = useRef<View>({ yaw: -0.22, pitch: 0.22, zoom: 1, spin: 0, panX: 0, panY: 0 });
  // where the zoom is heading; the frame loop glides the view towards it
  const zoomTarget = useRef(1);
  const [zoomPct, setZoomPct] = useState(100);
  const zoomTo = useCallback((z: number) => {
    const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    zoomTarget.current = next;
    setZoomPct(Math.round(next * 100));
  }, []);
  const zoomIn = useCallback(() => zoomTo(zoomTarget.current * ZOOM_STEP), [zoomTo]);
  const zoomOut = useCallback(() => zoomTo(zoomTarget.current / ZOOM_STEP), [zoomTo]);
  const resetView = useCallback(() => {
    viewRef.current.yaw = -0.22;
    viewRef.current.pitch = 0.22;
    viewRef.current.panX = 0;
    viewRef.current.panY = 0;
    zoomTo(1);
  }, [zoomTo]);
  const pickRef = useRef<Pick>({ id: null, x: -999, y: -999 });

  const [word, setWord] = useState(start);
  const [tool, setTool] = useState<Tool>("oxo");
  const [auto, setAuto] = useState(true);
  const [sister, setSister] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [attack, setAttack] = useState(false);
  const [rate, setRate] = useState(0.15);
  const [crews, setCrews] = useState(2);
  const [replicate, setReplicate] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  /* ---- full screen: the same component, laid out as a console ----------- */
  // The canvas is never remounted — only the layout classes change — so the
  // render loop and the molecule carry straight on.
  const rootRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const enterFull = useCallback(() => {
    // if the browser refuses real fullscreen, the fixed layout still fills the window
    rootRef.current?.requestFullscreen?.().catch(() => {});
    setFull(true);
  }, []);
  const exitFull = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setFull(false);
  }, []);
  useEffect(() => {
    const sync = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (!full) return;
    const body = document.body.style;
    const prev = body.overflow;
    body.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setFull(false);
    };
    window.addEventListener("keydown", key);
    return () => {
      body.overflow = prev;
      window.removeEventListener("keydown", key);
    };
  }, [full]);
  const [snap, setSnap] = useState<Snap>(() => snapshot(buildHelix(start)));
  const [history, setHistory] = useState<{ acc: number[]; waiting: number[] }>({
    acc: [1],
    waiting: [0],
  });

  // the loop reads everything through one ref, so changing a control never restarts it
  const optsRef = useRef({
    auto,
    sister,
    speed,
    paused,
    attack,
    rate,
    crews,
    replicate,
    tool,
    hover,
  });
  useEffect(() => {
    optsRef.current = { auto, sister, speed, paused, attack, rate, crews, replicate, tool, hover };
  }, [auto, sister, speed, paused, attack, rate, crews, replicate, tool, hover]);

  const rebuild = useCallback((w: string) => {
    // the box may be empty while you type a new word; keep the old molecule until there is one
    setWord(w);
    if (!w.trim()) return;
    helixRef.current = buildHelix(w);
    memRef.current = makeMemory();
    setSnap(snapshot(helixRef.current));
    setHistory({ acc: [1], waiting: [0] });
  }, []);

  /* ---- the loop: simulate, draw, report ------------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!memRef.current) memRef.current = makeMemory();
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const size = { w: 0, h: 0, dpr: 1 };
    const resize = () => {
      size.dpr = Math.min(window.devicePixelRatio || 1, 2);
      size.w = canvas.clientWidth;
      size.h = canvas.clientHeight;
      canvas.width = Math.round(size.w * size.dpr);
      canvas.height = Math.round(size.h * size.dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    let last = performance.now();
    let lastSnap = 0;
    let lastHist = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(canvas);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const o = optsRef.current;
      const h = helixRef.current;
      if (!o.paused) {
        // fixed small steps so a fast speed setting stays faithful
        let left = dt * o.speed;
        while (left > 0) {
          const step = Math.min(0.02, left);
          tick(h, step, {
            autoRepair: o.auto,
            crews: o.crews,
            sister: o.sister,
            damageRate: o.attack ? o.rate : 0,
            replicateEvery: o.attack && o.replicate ? 22 : 0,
            noticeDelay: 0.7,
          });
          left -= step;
        }
        // the molecule turns slowly — but holds still while you aim at a base
        if (!reduced && o.hover === null) viewRef.current.spin += dt * 0.16;
      }
      {
        const v = viewRef.current;
        v.zoom += (zoomTarget.current - v.zoom) * (reduced ? 1 : Math.min(1, dt * 10));
      }
      if (!visible) return;
      drawHelix(
        ctx,
        size,
        {
          helix: h,
          view: viewRef.current,
          hover: o.hover,
          toolLabel:
            o.tool === "repair"
              ? "click to send a repair crew"
              : `click: ${LESION_INFO[o.tool].name.toLowerCase()}`,
          toolColor: toolColor(o.tool),
          wall: now / 1000,
          reduced,
        },
        memRef.current!,
        pickRef.current,
      );
      if (pickRef.current.id !== o.hover) setHover(pickRef.current.id);
      if (now - lastSnap > 100) {
        lastSnap = now;
        const s = snapshot(h);
        setSnap(s);
        if (now - lastHist > 500 && !o.paused) {
          lastHist = now;
          setHistory((prev) => ({
            acc: [...prev.acc, s.readout.accuracy].slice(-120),
            waiting: [...prev.waiting, s.waiting].slice(-120),
          }));
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  /* ---- pointer: aim, click, orbit, zoom -------------------------------- */
  const drag = useRef<{ x: number; y: number; moved: boolean; down: boolean; pan: boolean }>({
    x: 0,
    y: 0,
    moved: false,
    down: false,
    pan: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomTo(zoomTarget.current * Math.exp(-e.deltaY * 0.0015));
    };
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  }, [zoomTo]);

  // + and − zoom from the keyboard, when you are not typing
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === "+" || e.key === "=") zoomTo(zoomTarget.current * ZOOM_STEP);
      if (e.key === "-" || e.key === "_") zoomTo(zoomTarget.current / ZOOM_STEP);
      if (e.key === "0") resetView();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [zoomTo, resetView]);

  /* ---- two fingers: pinch to zoom (touch boards have no scroll wheel) ----- */
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number; mx: number; my: number } | null>(null);
  const spread = () => {
    const [a, b] = [...touches.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const middle = () => {
    const [a, b] = [...touches.current.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  const act = useCallback(
    (id: number) => {
      const h = helixRef.current;
      if (tool === "repair") {
        const l = findLesions(h).find(
          (x) => x.id === id || x.partner === id || (x.kind === "break" && x.id === id),
        );
        if (l) startRepair(h, l, sister);
        return;
      }
      damage(h, tool, id);
    },
    [tool, sister],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* some touch boards refuse capture; the gesture still works without it */
    }
    if (touches.current.size === 2) {
      // a second finger turns the gesture into a pinch, never a click
      const m = middle();
      pinch.current = { dist: spread(), zoom: zoomTarget.current, mx: m.x, my: m.y };
      drag.current.moved = true;
      return;
    }
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      moved: false,
      down: true,
      pan: e.button === 2 || e.shiftKey,
    };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    pickRef.current.x = e.clientX - r.left;
    pickRef.current.y = e.clientY - r.top;
    if (touches.current.has(e.pointerId))
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && touches.current.size >= 2) {
      zoomTo((pinch.current.zoom * spread()) / Math.max(1, pinch.current.dist));
      // two fingers sliding together move the view, as on any touch screen
      const m = middle();
      const v = viewRef.current;
      v.panX = (v.panX ?? 0) + (m.x - pinch.current.mx);
      v.panY = (v.panY ?? 0) + (m.y - pinch.current.my);
      pinch.current.mx = m.x;
      pinch.current.my = m.y;
      return;
    }
    const d = drag.current;
    if (!d.down) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved) {
      const v = viewRef.current;
      if (d.pan) {
        v.panX = (v.panX ?? 0) + dx;
        v.panY = (v.panY ?? 0) + dy;
      } else {
        v.yaw = Math.max(-1.2, Math.min(1.2, v.yaw + dx * 0.006));
        v.pitch = Math.max(-0.9, Math.min(0.9, v.pitch + dy * 0.004));
      }
      d.x = e.clientX;
      d.y = e.clientY;
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    touches.current.delete(e.pointerId);
    if (touches.current.size < 2) pinch.current = null;
    const d = drag.current;
    if (d.down && !d.moved && hover !== null) act(hover);
    if (touches.current.size === 0) d.down = false;
  };
  const onPointerLeave = () => {
    pickRef.current.x = -999;
    pickRef.current.y = -999;
  };

  /* ---- helpers for the buttons ------------------------------------------ */
  const hitRandom = (kind: LesionKind) => damage(helixRef.current, kind);
  const sendCrew = () => {
    const h = helixRef.current;
    const l = findLesions(h)[0];
    if (l) startRepair(h, l, sister);
  };

  const r = snap.readout;
  const latest = snap.latest;
  const groups = Math.ceil(snap.sites.length / 4);

  return (
    <div
      ref={rootRef}
      className={cx(
        "bg-[#0b1220] text-slate-200",
        full
          ? "fixed inset-0 z-50 grid h-screen w-screen grid-cols-[minmax(0,1fr)_min(400px,40vw)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden"
          : "overflow-hidden rounded-2xl border border-[#1e2b3b] shadow-[0_30px_80px_-40px_rgba(6,40,40,0.8)]",
      )}
    >
      {/* ---- toolbar -------------------------------------------------------- */}
      <div
        className={cx(
          "flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-white/[0.07] px-4 py-3",
          full && "col-span-2 bg-[#081019]",
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mono mr-1 text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">
            Damage
          </span>
          {TOOLS.map((t) => {
            const on = tool === t.id;
            const c = toolColor(t.id);
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                title={`${LESION_INFO[t.id as LesionKind].name} — ${LESION_INFO[t.id as LesionKind].cause}`}
                className={cx(
                  "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
                  on ? "text-white" : "border-white/10 text-slate-300 hover:bg-white/5",
                )}
                style={
                  on
                    ? { borderColor: c, background: `${c}26`, boxShadow: `0 0 0 1px ${c}55` }
                    : undefined
                }
              >
                <Icon size={14} style={{ color: c }} />
                {t.label}
              </button>
            );
          })}
          <span className="mx-1 h-5 w-px bg-white/10" />
          <button
            onClick={() => setTool("repair")}
            title="Click a damaged base to send a repair crew to it yourself"
            className={cx(
              "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium",
              tool === "repair"
                ? "border-green-400 bg-green-400/15 text-white"
                : "border-white/10 text-slate-300 hover:bg-white/5",
            )}
          >
            <Wrench size={14} className="text-green-400" /> Repair by hand
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {tool !== "repair" && (
            <button
              onClick={() => hitRandom(tool)}
              className="mono flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11.5px] text-slate-300 hover:bg-white/5"
            >
              <Activity size={13} /> random hit
            </button>
          )}
          <button
            onClick={() => setPaused((p) => !p)}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[12px] text-slate-300 hover:bg-white/5"
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
            {paused ? "Resume" : "Pause"}
          </button>
          <div className="flex rounded-lg border border-white/10 p-0.5">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cx(
                  "mono cursor-pointer rounded-md px-2 py-1 text-[11px]",
                  speed === s ? "bg-teal-500 text-white" : "text-slate-400 hover:text-slate-200",
                )}
              >
                {s}×
              </button>
            ))}
          </div>
          <button
            onClick={() => rebuild(word.trim() ? word : "LIFE")}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[12px] text-slate-300 hover:bg-white/5"
          >
            <RotateCcw size={13} /> Fresh strand
          </button>
          <button
            onClick={full ? exitFull : enterFull}
            title={full ? "Leave full screen (Esc)" : "Full screen"}
            className={cx(
              "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px]",
              full
                ? "border-white/10 text-slate-300 hover:bg-white/5"
                : "border-teal-400/50 text-teal-300 hover:bg-teal-400/10",
            )}
          >
            {full ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {full ? "Exit" : "Full screen"}
            {full && (
              <kbd className="mono rounded border border-white/10 px-1 text-[9.5px] text-slate-500">
                esc
              </kbd>
            )}
          </button>
        </div>
      </div>

      {/* ---- the molecule ---------------------------------------------------- */}
      <div className={full ? "relative min-h-0" : "relative h-[520px]"}>
        <canvas
          ref={canvasRef}
          className={cx(
            "block h-full w-full touch-none",
            hover !== null ? "cursor-crosshair" : "cursor-grab",
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* the word, read live */}
        <div className="pointer-events-none absolute top-3 left-4">
          <div className="mono text-[9.5px] font-bold tracking-[0.18em] text-slate-500 uppercase">
            the molecule spells
          </div>
          <div className="mt-1 flex gap-1">
            {r.chars.map((c, i) => (
              <motion.div
                key={i}
                animate={{ scale: c.ok ? 1 : [1, 1.12, 1] }}
                transition={{ duration: 0.3 }}
                className="flex h-10 w-9 flex-col items-center justify-center rounded-md border"
                style={{
                  borderColor: c.ok ? "rgba(74,222,128,0.35)" : "rgba(248,113,113,0.55)",
                  background: c.ok ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.12)",
                }}
              >
                <span
                  className="mono text-[17px] leading-none font-bold"
                  style={{ color: c.ok ? "#86efac" : "#fca5a5" }}
                >
                  {c.got === " " ? "␣" : c.got || "·"}
                </span>
                <span className="mono mt-0.5 text-[8.5px] text-slate-500">{c.want}</span>
              </motion.div>
            ))}
          </div>
          <div className="mono mt-1.5 text-[10.5px] text-slate-400">
            <span style={{ color: r.accuracy >= 0.999 ? "#4ade80" : "#f87171" }}>
              {Math.round(r.accuracy * 100)}% intact
            </span>{" "}
            · {snap.waiting} lesion{snap.waiting === 1 ? "" : "s"} on the strand
          </div>
        </div>

        {/* the crews at work */}
        <div className="pointer-events-none absolute top-3 right-4 flex w-[230px] flex-col gap-1.5">
          <div className="mono text-right text-[9.5px] font-bold tracking-[0.18em] text-slate-500 uppercase">
            repair crews · {snap.jobs.length}/{crews}
          </div>
          <AnimatePresence initial={false}>
            {snap.jobs.map((j) => (
              <motion.div
                key={j.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className="rounded-lg border border-white/10 bg-[#0b1220]/85 px-2.5 py-1.5 backdrop-blur"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="mono rounded px-1.5 py-[1px] text-[9.5px] font-bold"
                    style={{
                      background: `${PATHWAY_INFO[j.pathway].color}22`,
                      color: PATHWAY_INFO[j.pathway].color,
                    }}
                  >
                    {j.pathway}
                  </span>
                  <span className="truncate text-[11px] font-semibold" style={{ color: j.color }}>
                    {j.enzyme}
                  </span>
                </div>
                <div className="mt-1 flex gap-0.5">
                  {j.steps.map((s, k) => (
                    <div key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: k < j.step ? "100%" : k === j.step ? `${j.frac * 100}%` : "0%",
                          background: PATHWAY_INFO[j.pathway].color,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {snap.jobs.length === 0 && snap.waiting > 0 && auto && (
            <div className="mono text-right text-[10.5px] text-amber-300/80">
              crews on their way…
            </div>
          )}
        </div>

        {/* narration */}
        <div className="pointer-events-none absolute right-4 bottom-4 left-4">
          <AnimatePresence mode="wait">
            {latest ? (
              <motion.div
                key={`${latest.id}-${latest.step}-${latest.done}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="mx-auto max-w-[760px] rounded-xl border bg-[#081019]/88 px-4 py-3 backdrop-blur-md"
                style={{ borderColor: `${PATHWAY_INFO[latest.pathway].color}55` }}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span
                    className="mono text-[10px] font-bold tracking-[0.14em] uppercase"
                    style={{ color: PATHWAY_INFO[latest.pathway].color }}
                  >
                    {PATHWAY_INFO[latest.pathway].name}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {latest.steps.map((s, k) => {
                      const done = latest.done || k < latest.step;
                      const now = !latest.done && k === latest.step;
                      return (
                        <span
                          key={k}
                          className="mono rounded-full border px-2 py-[1px] text-[9.5px]"
                          style={{
                            borderColor: now
                              ? PATHWAY_INFO[latest.pathway].color
                              : "rgba(255,255,255,0.1)",
                            color: now ? "#fff" : done ? "#94a3b8" : "#475569",
                            background: now
                              ? `${PATHWAY_INFO[latest.pathway].color}33`
                              : "transparent",
                          }}
                        >
                          {done ? "✓ " : ""}
                          {s.title}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <p className="mt-1.5 text-[13px] leading-snug text-slate-200">
                  {latest.done
                    ? latest.exact
                      ? "Done. The strand is exactly what it was — the partner strand had the answer all along."
                      : "Done, but not undone: the ends are joined and the bases at the break are gone for good. Look at the word."
                    : latest.caption}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mx-auto max-w-[640px] rounded-xl border border-white/10 bg-[#081019]/80 px-4 py-2.5 text-center text-[12.5px] text-slate-400 backdrop-blur"
              >
                Pick a kind of damage above, then click a base on the molecule. Drag to turn it;
                zoom with the buttons on the left, or pinch; two fingers (or right-drag) move it
                around.
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* zoom: touch boards have no scroll wheel, so the controls are buttons */}
        <div
          className={cx(
            "absolute top-1/2 left-3 z-10 flex -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border border-white/10 bg-[#081019]/80 p-1 backdrop-blur",
            full && "left-4 gap-1.5 p-1.5",
          )}
        >
          <ZoomButton
            label="Zoom in (+)"
            big={full}
            onClick={zoomIn}
            disabled={zoomPct >= ZOOM_MAX * 100}
          >
            <ZoomIn size={full ? 26 : 19} />
          </ZoomButton>
          <span
            className={cx("mono text-center text-slate-300", full ? "text-[12px]" : "text-[10px]")}
          >
            {zoomPct}%
          </span>
          <ZoomButton
            label="Zoom out (−)"
            big={full}
            onClick={zoomOut}
            disabled={zoomPct <= ZOOM_MIN * 100}
          >
            <ZoomOut size={full ? 26 : 19} />
          </ZoomButton>
          <button
            onClick={resetView}
            title="Reset the view (0)"
            aria-label="Reset the view"
            className={cx(
              "mt-0.5 flex cursor-pointer items-center justify-center rounded-xl border-t border-white/10 text-slate-300 hover:bg-white/10 active:bg-white/20",
              full ? "h-12 w-14" : "h-9 w-10",
            )}
          >
            <LocateFixed size={full ? 22 : 16} />
          </button>
        </div>

        {paused && (
          <div className="mono pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-black/60 px-3 py-1.5 text-[11px] tracking-[0.2em] text-slate-300">
            PAUSED
          </div>
        )}
      </div>

      {/* in full screen everything below the molecule becomes a docked side panel */}
      <div
        className={cx(full && "min-h-0 overflow-y-auto border-l border-white/[0.07] bg-[#0a101b]")}
      >
        {/* ---- controls strip ---------------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.07] px-4 py-2.5">
          <Toggle
            on={auto}
            onChange={setAuto}
            label="Cell repairs automatically"
            hint="Off: nothing gets fixed until you send a crew yourself"
          />
          <Toggle
            on={sister}
            onChange={setSister}
            label="Sister copy available"
            hint="On: the cell has just replicated, so breaks are fixed exactly by homologous recombination. Off: it must glue the ends (NHEJ)."
          />
          {!auto && (
            <button
              onClick={sendCrew}
              disabled={snap.waiting === 0}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-[12px] font-semibold text-[#052e16] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Wrench size={13} /> Send a crew
            </button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <input
              value={word}
              onChange={(e) =>
                rebuild(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z !?]/g, "")
                    .slice(0, 8),
                )
              }
              className="mono w-[104px] rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[13px] text-slate-100 outline-none focus:border-teal-400"
              aria-label="Word written into the DNA"
            />
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => rebuild(p)}
                className={cx(
                  "mono cursor-pointer rounded-md border px-2 py-1 text-[11px]",
                  word === p
                    ? "border-teal-400 bg-teal-400/10 text-teal-300"
                    : "border-white/10 text-slate-400 hover:bg-white/5",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* ---- the sequence, as a genome browser would show it ------------------- */}
        <div className="border-t border-white/[0.07] px-4 py-3">
          <div className="overflow-x-auto pb-1">
            <div className={cx("flex gap-2", full ? "flex-wrap" : "min-w-max")}>
              {Array.from({ length: groups }, (_, g) => {
                const chunk = snap.sites.slice(g * 4, g * 4 + 4);
                const want = word[g];
                const got = r.chars[g];
                return (
                  <div
                    key={g}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-1.5 pt-1.5 pb-1"
                  >
                    <div className="flex gap-[3px]">
                      {chunk.map((s) => {
                        const st = STATE_STYLE[s.state];
                        return (
                          <div
                            key={s.id}
                            title={st.label || `${s.letter}·${s.partner}`}
                            className="flex w-[22px] flex-col items-center gap-[3px]"
                          >
                            <span
                              className="mono flex h-[22px] w-[22px] items-center justify-center rounded-[5px] text-[11px] font-bold"
                              style={{
                                background: s.present
                                  ? BASE_HEX[s.letter as keyof typeof BASE_HEX]
                                  : "transparent",
                                color: s.present ? "#fff" : "#facc15",
                                border: s.present ? "none" : "1px dashed #facc15",
                                boxShadow:
                                  st.ring !== "transparent" ? `0 0 0 2px ${st.ring}` : undefined,
                                opacity: s.state === "gone" ? 0.25 : 1,
                              }}
                            >
                              {s.present ? s.letter : "–"}
                            </span>
                            <span
                              className="mono flex h-[18px] w-[22px] items-center justify-center rounded-[5px] text-[10px] font-semibold opacity-60"
                              style={{
                                background: `${BASE_HEX[s.partner as keyof typeof BASE_HEX]}55`,
                                color: "#e2e8f0",
                              }}
                            >
                              {s.partner}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mono mt-1 flex items-center justify-center gap-1 text-[10px]">
                      <span className="text-slate-500">{want ?? ""}</span>
                      <span className="text-slate-600">→</span>
                      <span style={{ color: got?.ok ? "#4ade80" : "#f87171" }}>
                        {got?.got || "·"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mono mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
            <span>top row: your strand · bottom row: its partner, the template</span>
            <span>every 4 bases = 8 bits = one letter</span>
            {Object.entries(STATE_STYLE)
              .filter(([k]) => k !== "ok" && k !== "gone")
              .map(([k, v]) => (
                <span key={k} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: v.ring }} />
                  {v.label}
                </span>
              ))}
          </div>
        </div>

        {/* ---- the cell under attack ------------------------------------------- */}
        <div
          className={cx(
            "grid gap-4 border-t border-white/[0.07] bg-[#0a101b] px-4 py-4",
            !full && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
          )}
        >
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[14px] font-semibold text-white">Let the world in</div>
                <p className="mt-0.5 text-[12px] leading-snug text-slate-400">
                  Damage arrives at random, the way it does in a living cell, while the crews race
                  to fix it. Every so often the cell copies its DNA — and anything not yet repaired
                  gets copied <em>as if it were correct</em>.
                </p>
              </div>
              <button
                onClick={() => setAttack((a) => !a)}
                className={cx(
                  "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold",
                  attack ? "bg-rose-500 text-white" : "bg-teal-500 text-[#04201d]",
                )}
              >
                {attack ? <Pause size={14} /> : <Play size={14} />}
                {attack ? "Stop the damage" : "Start"}
              </button>
            </div>
            <div className={cx("mt-3 grid grid-cols-1 gap-3", !full && "sm:grid-cols-3")}>
              <label className="text-[11.5px] text-slate-400">
                <div className="mb-1 flex justify-between">
                  <span>damage rate</span>
                  <span className="mono text-slate-200">{(rate * 60).toFixed(0)}/min</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={60}
                  value={Math.round(rate * 100)}
                  onChange={(e) => setRate(Number(e.target.value) / 100)}
                  style={{ color: "#f43f5e" }}
                />
              </label>
              <label className="text-[11.5px] text-slate-400">
                <div className="mb-1 flex justify-between">
                  <span>repair crews</span>
                  <span className="mono text-slate-200">{crews}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={crews}
                  onChange={(e) => setCrews(Number(e.target.value))}
                  style={{ color: ACCENT }}
                />
              </label>
              <div className="flex items-end">
                <Toggle
                  on={replicate}
                  onChange={setReplicate}
                  label="Replicate every 22 s"
                  hint="The replication fork turns any lesion it meets into a permanent mutation"
                />
              </div>
            </div>
          </div>

          <div className={cx("grid grid-cols-2 gap-2", !full && "sm:grid-cols-4")}>
            {[
              { k: "Damage", v: snap.stats.damaged, c: "#fb7185" },
              { k: "Repaired", v: snap.stats.repaired, c: "#4ade80" },
              {
                k: "Mutations",
                v: snap.stats.mutations,
                c: "#f87171",
                hint: "copied past a lesion",
              },
              { k: "Bases lost", v: snap.stats.lost, c: "#fbbf24", hint: "by end joining" },
            ].map((s) => (
              <div
                key={s.k}
                className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2"
                title={s.hint}
              >
                <div className="mono text-[9px] tracking-[0.14em] text-slate-500 uppercase">
                  {s.k}
                </div>
                <div className="mono text-[20px] leading-tight font-bold" style={{ color: s.c }}>
                  {s.v}
                </div>
              </div>
            ))}
            <div className={cx("col-span-2", !full && "sm:col-span-4")}>
              <div className="mono flex justify-between text-[9.5px] tracking-[0.14em] text-slate-500 uppercase">
                <span>word intact</span>
                <span>lesions waiting</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Sparkline data={history.acc} color="#4ade80" />
                <Sparkline
                  data={history.waiting}
                  color="#fb923c"
                  max={Math.max(4, ...history.waiting)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
