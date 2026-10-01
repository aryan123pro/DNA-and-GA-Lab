"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { World, trailDuration } from "@/lib/rocket/physics";
import {
  PaintData,
  SceneMemory,
  SceneRocket,
  drawScene,
  makeMemory,
  themeFor,
} from "./sceneRender";

export type { SceneRocket };

/* -------------------------------------------------------------------------- */
/* playback                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Flights are simulated up front and then *replayed*, which is why forty
 * boosters can fall at once without the physics ever touching a frame budget.
 * The clock lives in a ref; only the rendered value goes through React.
 */
export function usePlayback(duration: number, speed: number, running: boolean) {
  const [t, setT] = useState(0);
  const tRef = useRef(0);
  const lastRef = useRef(0);
  const rafRef = useRef(0);
  const [ended, setEnded] = useState(false);
  // bumped by seek() so that scrubbing can restart a loop that already finished
  const [nonce, setNonce] = useState(0);

  const seek = useCallback((v: number) => {
    tRef.current = v;
    setT(v);
    setEnded(false);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!running || ended) return;
    lastRef.current = 0;
    const tick = (now: number) => {
      const dt = lastRef.current ? Math.min(0.06, (now - lastRef.current) / 1000) : 0;
      lastRef.current = now;
      tRef.current += dt * speed;
      if (tRef.current >= duration) {
        tRef.current = duration;
        setT(duration);
        setEnded(true);
        return;
      }
      setT(tRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, speed, duration, ended, nonce]);

  return { t, seek, ended };
}

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/* -------------------------------------------------------------------------- */

const WORLD_DOT: Record<World["id"], string> = {
  earth: "#3b82f6",
  mars: "#c2410c",
  moon: "#cbd5e1",
};

export default function LaunchScene({
  rockets,
  t,
  world,
  wind = 0,
  height = 440,
  inset,
  overlay,
  guide = false,
  tag = null,
  badge = true,
}: {
  rockets: SceneRocket[];
  t: number;
  world: World;
  /** steady crosswind, drawn as an arrow so the slider has visible consequences */
  wind?: number;
  height?: number | string;
  /** keep this many pixels clear at the top and bottom for floating panels */
  inset?: { top?: number; bottom?: number };
  /** kept for call-site compatibility; the section view needs no fake depth */
  spread?: number;
  overlay?: React.ReactNode;
  /** draw the stopping-distance bracket under the hero */
  guide?: boolean;
  /** a caption pinned to the hero */
  tag?: string | null;
  /** the world name in the corner */
  badge?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const memRef = useRef<SceneMemory | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const top = inset?.top ?? 0;
  const bottom = inset?.bottom ?? 0;
  const dataRef = useRef<PaintData>({
    rockets,
    t,
    world,
    wind,
    inset: { top, bottom },
    guide,
    tag,
  });

  /* ---- the frame loop -------------------------------------------------------
   * The scene paints itself every animation frame rather than only when React
   * hands it a new clock. That is what lets a crash keep burning, and a landed
   * booster keep venting, after the replay itself has stopped. It sleeps while
   * the canvas is off screen.
   * ------------------------------------------------------------------------ */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!memRef.current) memRef.current = makeMemory();
    const mem = memRef.current;
    const reduced = prefersReducedMotion();
    let raf = 0;
    let visible = true;

    const paint = () => {
      drawScene(canvas, sizeRef.current, dataRef.current, mem, performance.now() / 1000, reduced);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      paint();
    };

    const loop = () => {
      paint();
      raf = requestAnimationFrame(loop);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      const now = entry.isIntersecting;
      if (now === visible) return;
      visible = now;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(loop);
    });
    io.observe(canvas);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  /* ---- hand the latest flight to the loop ---------------------------------- */
  useEffect(() => {
    dataRef.current = { rockets, t, world, wind, inset: { top, bottom }, guide, tag };
  }, [rockets, t, world, wind, top, bottom, guide, tag]);

  const theme = themeFor(world);
  const dark = theme.dark;

  return (
    <div
      className="relative overflow-hidden"
      style={{ height, background: theme.sky[theme.sky.length - 1][1] }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      {badge && (
        <div
          className="pointer-events-none absolute top-3 left-4 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-[0_6px_20px_-10px_rgba(0,0,0,0.5)] backdrop-blur-md"
          style={{
            background: dark ? "rgba(12,17,26,0.7)" : "rgba(255,255,255,0.72)",
            borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.7)",
            color: dark ? "#e2e8f0" : "#16191f",
          }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background: WORLD_DOT[world.id],
              boxShadow: `0 0 0 3px ${WORLD_DOT[world.id]}33`,
            }}
          />
          <div>
            <div className="eyebrow leading-none">{world.name}</div>
            <div className="mono mt-0.5 text-[10.5px] opacity-70">
              g {world.gravity.toFixed(2)} m/s² · {world.airDensity > 0 ? "atmosphere" : "no air"}
            </div>
          </div>
        </div>
      )}
      {overlay}
    </div>
  );
}

export { trailDuration };
