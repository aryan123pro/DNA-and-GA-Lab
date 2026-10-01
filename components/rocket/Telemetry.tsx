"use client";

import { LANDING, MIN_THROTTLE } from "@/lib/rocket/physics";
import { cx } from "@/components/ui";

/**
 * The readout deliberately apes a launch webcast: one row of big monospace
 * numbers, a throttle bar, and nothing else. Every value is the real simulated
 * quantity, and the ones that decide whether the booster survives turn amber
 * when they go out of limits.
 */
export interface TelemetryValues {
  altitude: number;
  descentRate: number;
  lateralSpeed: number;
  tiltDeg: number;
  fuel: number;
  fuelMax: number;
  throttle: number;
  offset: number;
  /** engine starts used so far — only shown when the pilot is a person */
  ignitions?: number;
  maxIgnitions?: number;
}

function Readout({
  label,
  value,
  unit,
  bad,
  wide,
  dense,
}: {
  label: string;
  value: string;
  unit: string;
  bad?: boolean;
  wide?: boolean;
  dense?: boolean;
}) {
  return (
    <div
      className={cx(
        "min-w-0 rounded-lg border transition-colors",
        dense ? "px-2 py-1.5" : "px-2.5 py-2",
        bad ? "border-amber-400/40 bg-amber-400/10" : "border-white/[0.06] bg-white/[0.03]",
        wide && "col-span-2",
      )}
    >
      <div className="mono text-[9px] tracking-[0.16em] text-panel-ink-2 uppercase">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={cx(
            "mono leading-none font-bold tabular-nums",
            dense ? "text-[15px]" : "text-[18px]",
          )}
          style={{ color: bad ? "#fbbf24" : "#e8eef6" }}
        >
          {value}
        </span>
        <span className="mono text-[9.5px] text-panel-ink-2">{unit}</span>
      </div>
    </div>
  );
}

function Bar({
  value,
  color,
  label,
  floor,
}: {
  value: number;
  color: string;
  label: string;
  /** a tick on the track, e.g. the throttle floor */
  floor?: number;
}) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div>
      <div className="mono mb-1 flex justify-between text-[9.5px] tracking-[0.14em] text-panel-ink-2 uppercase">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <div className="relative h-[6px] overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-100"
          style={{
            width: `${v * 100}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            boxShadow: v > 0 ? `0 0 10px ${color}` : undefined,
          }}
        />
        {floor !== undefined && (
          <div
            className="absolute top-0 h-full w-px bg-white/40"
            style={{ left: `${floor * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

export default function Telemetry({
  v,
  cols = 4,
  dense = false,
}: {
  v: TelemetryValues;
  /** two columns when it is living in a narrow sidebar */
  cols?: 2 | 4;
  /** tighter, for the fullscreen console where every pixel of height counts */
  dense?: boolean;
}) {
  const touchingDown = v.altitude < 40;
  const lit = v.throttle > 0;
  const showStarts = v.ignitions !== undefined && v.maxIgnitions !== undefined;
  const startsLeft = showStarts ? v.maxIgnitions! - v.ignitions! : 0;

  return (
    <div className="w-full rounded-xl border border-white/10 bg-[radial-gradient(120%_140%_at_0%_0%,#1a2533_0%,#0e151d_60%)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="mono mb-2.5 flex items-center justify-between gap-3 text-[9.5px] tracking-[0.16em] text-panel-ink-2 uppercase">
        <span className="flex items-center gap-1.5">
          <span
            className={cx("h-2 w-2 rounded-full", lit && "animate-pulse")}
            style={{
              background: lit ? "#fb923c" : "#334155",
              boxShadow: lit ? "0 0 8px #fb923c" : undefined,
            }}
          />
          {lit ? "Engine lit" : "Engine cold"}
        </span>
        {showStarts && (
          <span
            className="flex items-center gap-1.5"
            title="The igniter fluid (TEA-TEB) is only good for a few engine starts. Once it is gone, the engine will not light again."
          >
            starts
            <span className="flex gap-[3px]">
              {Array.from({ length: v.maxIgnitions! }, (_, i) => (
                <span
                  key={i}
                  className="h-2 w-[7px] rounded-[2px]"
                  style={{
                    background: i < startsLeft ? "#4ade80" : "rgba(255,255,255,0.12)",
                    boxShadow: i < startsLeft ? "0 0 6px rgba(74,222,128,0.6)" : undefined,
                  }}
                />
              ))}
            </span>
            {startsLeft === 0 && <span className="text-red-400">none left</span>}
          </span>
        )}
      </div>
      <div
        className={cx(
          "grid",
          dense ? "gap-1.5" : "gap-2",
          cols === 2 ? "grid-cols-2" : dense ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4",
        )}
      >
        <Readout dense={dense} label="Altitude" value={Math.max(0, v.altitude).toFixed(0)} unit="m" />
        <Readout
          dense={dense}
          label="Descent"
          value={v.descentRate.toFixed(1)}
          unit="m/s"
          bad={touchingDown && v.descentRate > LANDING.maxDescentRate}
        />
        <Readout
          dense={dense}
          label="Drift"
          value={v.lateralSpeed.toFixed(1)}
          unit="m/s"
          bad={touchingDown && v.lateralSpeed > LANDING.maxLateralSpeed}
        />
        <Readout
          dense={dense}
          label="Tilt"
          value={v.tiltDeg.toFixed(1)}
          unit="°"
          bad={touchingDown && v.tiltDeg > (LANDING.maxTilt * 180) / Math.PI}
        />
      </div>
      <div
        className={cx(
          "grid gap-4",
          dense ? "mt-2.5" : "mt-3",
          cols === 2 ? "grid-cols-1" : "grid-cols-2",
        )}
      >
        <Bar value={v.throttle} color="#fb923c" label="Throttle" floor={MIN_THROTTLE} />
        <Bar
          value={v.fuelMax > 0 ? v.fuel / v.fuelMax : 0}
          color={v.fuel < v.fuelMax * 0.15 ? "#f87171" : "#38bdf8"}
          label="Propellant"
        />
      </div>
      <div className="mono mt-2.5 flex flex-wrap justify-between gap-x-3 text-[10px] text-panel-ink-2">
        <span>
          off pad{" "}
          <span
            style={{
              color: Math.abs(v.offset) > LANDING.padRadius ? "#fbbf24" : "#8b99ab",
            }}
          >
            {v.offset >= 0 ? "+" : ""}
            {v.offset.toFixed(1)} m
          </span>
        </span>
        <span>
          limit ±{LANDING.padRadius} m · {LANDING.maxDescentRate} m/s ·{" "}
          {(LANDING.maxTilt * 180) / Math.PI}°
        </span>
      </div>
    </div>
  );
}
