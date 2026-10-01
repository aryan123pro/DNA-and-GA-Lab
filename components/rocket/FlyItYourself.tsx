"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Crosshair, RotateCcw, Rocket } from "lucide-react";
import LaunchScene, { SceneRocket } from "./LaunchScene";
import FullscreenStage, { ExpandButton, Hud, HudTitle, useStage } from "./Fullscreen";
import Telemetry from "./Telemetry";
import {
  DT,
  DRY_MASS,
  LANDING,
  MAX_GIMBAL,
  MAX_IGNITIONS,
  MIN_THROTTLE,
  NOMINAL_START,
  RocketState,
  TRAIL_STRIDE,
  Trail,
  WORLDS,
  makeState,
  stepRocket,
} from "@/lib/rocket/physics";
import { Button, Card, Chip, Note, cx } from "@/components/ui";

const ACCENT = "#ea580c";
const WORLD = WORLDS.earth;
const TRAIL_CAPACITY = (Math.ceil(WORLD.maxFlightTime / DT) + 2) * TRAIL_STRIDE;

/** The flight writes into this buffer every physics step; the scene reads it every frame. */
function record(trail: Trail, s: RocketState) {
  if (trail.count * TRAIL_STRIDE + TRAIL_STRIDE > trail.data.length) return;
  const i = trail.count * TRAIL_STRIDE;
  trail.data[i] = s.x;
  trail.data[i + 1] = s.y;
  trail.data[i + 2] = s.angle;
  trail.data[i + 3] = s.throttle;
  trail.data[i + 4] = s.gimbal;
  trail.data[i + 5] = s.fuel;
  trail.count++;
}

function freshTrail(s: RocketState): Trail {
  const trail: Trail = { dt: DT, count: 0, data: new Float32Array(TRAIL_CAPACITY) };
  record(trail, s);
  return trail;
}

function makeScene(trail: Trail, outcome: RocketState["status"]): SceneRocket[] {
  return [{ id: "you", trail, outcome, hero: true }];
}

/**
 * The same simulator the genetic algorithm uses, driven by a keyboard instead
 * of a genome. Fifteen seconds of this is worth a thousand words about why a
 * booster that cannot hover is hard to land.
 */
export default function FlyItYourself() {
  const [state, setState] = useState<RocketState>(() => makeState(NOMINAL_START));
  const [rockets, setRockets] = useState<SceneRocket[]>(() =>
    makeScene(freshTrail(makeState(NOMINAL_START)), "flying"),
  );
  const [flying, setFlying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [landings, setLandings] = useState(0);
  const [guide, setGuide] = useState(false);
  const stage = useStage();
  const flyingRef = useRef(false);

  const keys = useRef({ thrust: false, left: false, right: false });
  const stateRef = useRef(state);
  const trailRef = useRef<Trail | null>(null);
  const rafRef = useRef(0);
  const accRef = useRef(0);
  const lastRef = useRef(0);

  /** Fresh booster, fresh trail. Called from a button, never from render. */
  const arm = useCallback((start: boolean) => {
    const s = makeState(NOMINAL_START);
    const trail = freshTrail(s);
    trailRef.current = trail;
    stateRef.current = s;
    setState(s);
    setRockets(makeScene(trail, "flying"));
    setFlying(start);
    flyingRef.current = start;
    // a focused button would also hear the space bar and restart the flight
    if (start && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, []);

  /* ---- keyboard ---------------------------------------------------------- */
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const isThrust = (k: string) => k === " " || k === "ArrowUp" || k === "w";
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (isThrust(e.key)) {
        keys.current.thrust = true;
        // only swallow the key mid-flight, so the page still scrolls otherwise
        if (flyingRef.current) e.preventDefault();
      }
      if (e.key === "ArrowLeft" || e.key === "a") keys.current.left = true;
      if (e.key === "ArrowRight" || e.key === "d") keys.current.right = true;
      if (flyingRef.current && (e.key === "ArrowLeft" || e.key === "ArrowRight"))
        e.preventDefault();
      // Enter or R relaunches between attempts
      if (!flyingRef.current && !e.repeat && (e.key === "Enter" || e.key === "r")) {
        const el = e.target as HTMLElement | null;
        if (el?.tagName === "BUTTON" && e.key === "Enter") return;
        keys.current.thrust = false;
        arm(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (isThrust(e.key)) {
        keys.current.thrust = false;
        if (flyingRef.current) e.preventDefault();
      }
      if (e.key === "ArrowLeft" || e.key === "a") keys.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d") keys.current.right = false;
    };
    // a key released while the window is in the background never sends keyup
    const release = () => {
      keys.current = { thrust: false, left: false, right: false };
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", release);
    };
  }, [arm]);

  /* ---- the flight --------------------------------------------------------- */
  useEffect(() => {
    if (!flying) return;
    lastRef.current = 0;
    accRef.current = 0;

    const tick = (now: number) => {
      const wall = lastRef.current ? Math.min(0.05, (now - lastRef.current) / 1000) : 0;
      lastRef.current = now;
      accRef.current += wall;

      let s = stateRef.current;
      const trail = trailRef.current;
      // fixed-step physics regardless of frame rate, so it stays deterministic
      while (accRef.current >= DT && s.status === "flying") {
        const gimbal =
          (keys.current.left ? MAX_GIMBAL : 0) + (keys.current.right ? -MAX_GIMBAL : 0);
        s = stepRocket(s, { throttle: keys.current.thrust ? 1 : 0, gimbal }, WORLD, DT);
        if (trail) record(trail, s);
        accRef.current -= DT;
      }
      stateRef.current = s;
      setState(s);

      if (s.status !== "flying") {
        setFlying(false);
        flyingRef.current = false;
        setAttempts((a) => a + 1);
        if (s.status === "landed") setLandings((l) => l + 1);
        if (trail) setRockets(makeScene(trail, s.status));
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [flying]);

  const hold = (key: "thrust" | "left" | "right") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      keys.current[key] = true;
    },
    onPointerUp: () => {
      keys.current[key] = false;
    },
    onPointerLeave: () => {
      keys.current[key] = false;
    },
  });

  const done = state.status !== "flying";
  const minTWR =
    (MIN_THROTTLE * WORLD.maxThrust) / ((DRY_MASS + NOMINAL_START.fuel) * WORLD.gravity);

  /* ---- pieces shared by both layouts -------------------------------------- */

  // Each limit, checked the same way the physics checks it, so the card can say
  // exactly which one failed instead of just "crashed".
  const checks = [
    {
      label: "descent",
      value: `${Math.abs(state.vy).toFixed(1)} m/s`,
      limit: `≤ ${LANDING.maxDescentRate}`,
      ok: Math.abs(state.vy) <= LANDING.maxDescentRate,
    },
    {
      label: "drift",
      value: `${Math.abs(state.vx).toFixed(1)} m/s`,
      limit: `≤ ${LANDING.maxLateralSpeed}`,
      ok: Math.abs(state.vx) <= LANDING.maxLateralSpeed,
    },
    {
      label: "tilt",
      value: `${Math.abs((state.angle * 180) / Math.PI).toFixed(1)}°`,
      limit: `≤ ${(LANDING.maxTilt * 180) / Math.PI}°`,
      ok: Math.abs(state.angle) <= LANDING.maxTilt,
    },
    {
      label: "off centre",
      value: `${Math.abs(state.x).toFixed(1)} m`,
      limit: `≤ ${LANDING.padRadius} m`,
      ok: Math.abs(state.x) <= LANDING.padRadius,
    },
  ];
  // it never reached the ground: out of bounds or out of time
  const neverLanded = state.status === "crashed" && state.y > 0.5;

  const outcome = done ? (
    // held back for a beat so the explosion — or the touchdown — gets seen first
    <motion.div
      key={`${attempts}-${state.status}`}
      className="pointer-events-none absolute top-[84px] left-4 right-4 flex justify-start"
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: state.status === "landed" ? 1.2 : 2.2, duration: 0.35 }}
    >
      <div className="pointer-events-auto w-full max-w-[370px] rounded-2xl border border-white/15 bg-[#0b1119]/80 px-4 py-3 text-left shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-md">
        <div
          className="mono text-[10px] font-bold tracking-[0.18em] uppercase"
          style={{ color: state.status === "landed" ? "#34d399" : "#f87171" }}
        >
          {state.status === "landed" ? "Touchdown" : neverLanded ? "Flight terminated" : "Impact"}
        </div>
        <div className="font-display mt-0.5 text-[18px] leading-tight font-semibold text-white">
          {state.status === "landed" ? "Booster recovered" : "Rapid unscheduled disassembly"}
        </div>
        {neverLanded ? (
          <div className="mono mt-2 text-[11.5px] text-panel-ink-2">
            It left the range or ran out the clock before reaching the deck.
          </div>
        ) : (
          <div className="mt-2.5 grid grid-cols-4 gap-1">
            {checks.map((c) => (
              <div
                key={c.label}
                className="rounded-lg border px-1.5 py-1 text-center"
                style={{
                  borderColor: c.ok ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.45)",
                  background: c.ok ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.1)",
                }}
              >
                <div className="mono truncate text-[8.5px] tracking-[0.1em] text-panel-ink-2 uppercase">
                  {c.label}
                </div>
                <div
                  className="mono text-[12px] font-bold tabular-nums"
                  style={{ color: c.ok ? "#6ee7b7" : "#fca5a5" }}
                >
                  {c.value}
                </div>
                <div className="mono text-[9px] text-panel-ink-2">{c.limit}</div>
              </div>
            ))}
          </div>
        )}
        <div className="mono mt-2 text-[10px] text-panel-ink-2">
          press <span className="text-white">R</span> or <span className="text-white">Enter</span>{" "}
          to fly again
        </div>
      </div>
    </motion.div>
  ) : null;

  const scene = (h: number | string, inset?: { top?: number; bottom?: number }) => (
    <LaunchScene
      rockets={rockets}
      t={state.t}
      world={WORLD}
      height={h}
      inset={inset}
      spread={0}
      overlay={outcome}
      guide={guide}
    />
  );

  const telemetry = (cols: 2 | 4, dense = false) => (
    <Telemetry
      cols={cols}
      dense={dense}
      v={{
        altitude: state.y,
        descentRate: Math.abs(state.vy),
        lateralSpeed: Math.abs(state.vx),
        tiltDeg: Math.abs((state.angle * 180) / Math.PI),
        fuel: state.fuel,
        fuelMax: NOMINAL_START.fuel,
        throttle: state.throttle,
        offset: state.x,
        ignitions: state.ignitions,
        maxIgnitions: MAX_IGNITIONS,
      }}
    />
  );

  const flightButtons = (
    <>
      {attempts > 0 && (
        <Chip accent={landings > 0 ? "#15803d" : "#7b8592"}>
          {landings} landed / {attempts} tried
        </Chip>
      )}
      <Button
        size="sm"
        variant={guide ? "solid" : "outline"}
        accent={guide ? "#15803d" : ACCENT}
        onClick={() => setGuide((g) => !g)}
        title="Draw how far the booster would fall before stopping if you lit the engine now"
      >
        <Crosshair size={13} /> {guide ? "Guide on" : "Guide"}
      </Button>
      {!flying ? (
        <Button accent={ACCENT} onClick={() => arm(true)}>
          <Rocket size={15} /> {attempts === 0 ? "Begin descent" : "Try again"}
        </Button>
      ) : (
        <Button variant="quiet" onClick={() => arm(false)}>
          <RotateCcw size={15} /> Reset
        </Button>
      )}
    </>
  );

  const touchPad = (always: boolean) => (
    <div className={cx("flex items-center justify-center gap-3", always ? "" : "sm:hidden")}>
      {(
        [
          ["left", "←"],
          ["thrust", "BURN"],
          ["right", "→"],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          {...hold(key)}
          className={cx(
            "mono min-w-[68px] touch-none rounded-xl border px-4 py-3 text-[13px] font-bold shadow-sm transition-transform select-none active:scale-95",
            key === "thrust"
              ? "min-w-[96px] border-orange-400 bg-gradient-to-b from-orange-500 to-orange-600 text-white active:from-orange-600"
              : "border-line bg-surface text-ink-2 active:bg-sunken",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const why = (
    <Note accent={ACCENT} title="Why that was so hard">
      At minimum throttle this engine still produces about {minTWR.toFixed(2)} times the
      booster&apos;s weight. It cannot hover, it cannot ease down, and it cannot hesitate. Burn too
      early and you stop dead in mid-air, then fall again with an empty tank. Burn too late and you
      arrive at the deck doing ninety. The only thing that works is falling most of the way and
      lighting the engine at exactly the right moment — which is what the search in the next step
      has to discover on its own.
    </Note>
  );

  /* ---- the whole screen: a console with the sky in the middle ------------- */

  const keyRow = (keys: string[], action: string) => (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="mono min-w-[26px] rounded-md border border-line bg-sunken px-1.5 py-0.5 text-center text-[11px] text-ink shadow-[inset_0_-2px_0_rgba(0,0,0,0.35)]"
          >
            {k}
          </kbd>
        ))}
      </span>
      <span className="text-[12px] text-ink-2">{action}</span>
    </div>
  );

  const overlayStage = (
    <FullscreenStage
      stage={stage}
      title="Land it yourself"
      subtitle="Earth · one Merlin · no throttle below 40 per cent"
      status={
        flying
          ? "live"
          : state.status === "landed"
            ? "good"
            : state.status === "crashed"
              ? "bad"
              : "idle"
      }
      stats={[
        { label: "Landed", value: landings, tone: landings > 0 ? "#4ade80" : undefined },
        { label: "Attempts", value: attempts },
        {
          label: "Record",
          value: attempts ? `${Math.round((landings / attempts) * 100)}%` : "—",
        },
      ]}
      scene={scene("100%", { top: 16, bottom: 84 })}
      bar={<div className="flex flex-wrap items-center gap-2">{flightButtons}</div>}
      pinned={telemetry(4, true)}
      tabs={[
        {
          id: "pilot",
          label: "Pilot",
          content: (
            <div className="space-y-3">
              <Hud>
                <HudTitle>Controls</HudTitle>
                <div className="divide-y divide-line">
                  {keyRow(["space", "↑"], "fire the engine (full power)")}
                  {keyRow(["←", "→"], "swivel the engine")}
                  {keyRow(["R", "↵"], "fly again")}
                  {keyRow(["esc"], "leave full screen")}
                </div>
              </Hud>
              <Hud>
                <HudTitle hint="For touch screens, or if you would rather click.">
                  Touch controls
                </HudTitle>
                {touchPad(true)}
              </Hud>
            </div>
          ),
        },
        {
          id: "guide",
          label: "Guide",
          content: (
            <Hud>
              <HudTitle>Stopping distance</HudTitle>
              <p className="text-[12.5px] leading-[1.6] text-ink-2">
                Turn on <strong className="text-ink">Guide</strong> in the bar below and a bracket
                hangs under the booster: how far it would fall before stopping if you lit the engine
                at full power right now. It shrinks as you burn and grows as you fall.
              </p>
              <p className="mt-2 text-[12.5px] leading-[1.6] text-ink-2">
                When its foot touches the deck it turns amber and says{" "}
                <span className="mono font-bold text-amber-400">BURN NOW</span>. Red means you have
                left it too late.
              </p>
            </Hud>
          ),
        },
        { id: "why", label: "Why it is hard", content: why },
      ]}
    />
  );

  /* ---- the page layout ------------------------------------------------------ */

  return (
    <Card pad={false}>
      {overlayStage}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5">
        <div>
          <h3 className="text-[16px] font-semibold text-ink">Land it yourself</h3>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            Hold <kbd className="mono rounded bg-sunken px-1.5 py-0.5 text-[11px]">space</kbd> to
            fire the engine,{" "}
            <kbd className="mono rounded bg-sunken px-1.5 py-0.5 text-[11px]">←</kbd>{" "}
            <kbd className="mono rounded bg-sunken px-1.5 py-0.5 text-[11px]">→</kbd> to steer.
            There is no throttle in between — it is off, or it is at full — and only {MAX_IGNITIONS}{" "}
            engine starts in the tank.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {flightButtons}
          <ExpandButton onClick={stage.enter} />
        </div>
      </div>

      {stage.open ? (
        <div className="flex items-center justify-center bg-sunken" style={{ height: 420 }}>
          <span className="mono text-[12px] text-ink-3">flying full screen</span>
        </div>
      ) : (
        scene(420)
      )}

      {/* the readout sits under the scene, never on top of the landing pad */}
      <div className="border-t border-line-soft px-5 py-4">{telemetry(4)}</div>

      <div className="border-t border-line-soft px-5 py-3">{touchPad(false)}</div>

      <div className="px-5 py-4">{why}</div>
    </Card>
  );
}
