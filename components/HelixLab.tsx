"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { OrbitView, COORDINATE_SYSTEM, type PickingInfo } from "@deck.gl/core";
import { LineLayer, ScatterplotLayer, TextLayer, PolygonLayer } from "@deck.gl/layers";
import { scaleLinear } from "d3-scale";
import { line as d3line, curveMonotoneX } from "d3-shape";
import { Hammer, RotateCcw, Shuffle, Zap } from "lucide-react";
import { Base, bytesToText, textToBytes } from "@/lib/dna";
import { bitArrayToBytes, bytesToBitArray } from "@/lib/repair";
import { BASE_COLOR, Button, Chip, Segmented, cx } from "./ui";

/* -------------------------------------------------------------------------- */
/* geometry                                                                   */
/* -------------------------------------------------------------------------- */

const RADIUS = 26;
const RISE = 13; // vertical gap between consecutive base pairs
const TWIST = 0.55; // radians of rotation per base pair
const FLOOR = -16;
const GRAVITY = -220; // units per second squared
const BOUNCE = 0.42;

const VALUE: Record<Base, number> = { A: 0, C: 1, G: 2, T: 3 };
const LETTER: Base[] = ["A", "C", "G", "T"];
const PARTNER: Record<Base, Base> = { A: "T", T: "A", C: "G", G: "C" };

type Pos = [number, number, number];
type RGB = [number, number, number];
function rgb(hex: string): RGB {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}
const BASE_RGB: Record<string, RGB> = Object.fromEntries(
  Object.entries(BASE_COLOR).map(([k, v]) => [k, rgb(v)]),
) as Record<string, RGB>;

interface Nuc {
  i: number;
  letter: Base;
  /** the seat it was written into — never moves */
  home: Pos;
  /** where it is right now */
  pos: Pos;
  vel: Pos;
  /** false once you have knocked it off the backbone */
  attached: boolean;
  /** true once it has stopped bouncing */
  asleep: boolean;
  /** true if you changed its letter rather than knocking it out */
  mutated: boolean;
}

function seat(i: number, side: 0 | 1): Pos {
  const a = i * TWIST + (side ? Math.PI : 0);
  return [Math.cos(a) * RADIUS, i * RISE, Math.sin(a) * RADIUS];
}

function buildStrand(word: string): Nuc[] {
  const bits = bytesToBitArray(textToBytes(word));
  const out: Nuc[] = [];
  for (let i = 0; i < bits.length / 2; i++) {
    const v = (bits[i * 2] << 1) | bits[i * 2 + 1];
    const home = seat(i, 0);
    out.push({
      i,
      letter: LETTER[v],
      home,
      pos: [...home] as Pos,
      vel: [0, 0, 0],
      attached: true,
      asleep: true,
      mutated: false,
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* the d3 sparkline — integrity as you wreck the molecule                     */
/* -------------------------------------------------------------------------- */

function Integrity({ history, accent }: { history: number[]; accent: string }) {
  const W = 260;
  const H = 46;
  const x = scaleLinear()
    .domain([0, Math.max(9, history.length - 1)])
    .range([2, W - 2]);
  const y = scaleLinear().domain([0, 1]).range([H - 3, 3]);
  const path =
    d3line<number>()
      .x((_, i) => x(i))
      .y((d) => y(d))
      .curve(curveMonotoneX)(history) ?? "";
  const last = history[history.length - 1] ?? 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: W }}>
      <line x1={2} y1={y(1)} x2={W - 2} y2={y(1)} stroke="#2a3644" strokeDasharray="3 3" />
      <path d={path} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" />
      {history.length > 0 && (
        <circle cx={x(history.length - 1)} cy={y(last)} r={3.5} fill={accent} />
      )}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

const ACCENT = "#0d9488";
const PRESETS = ["LIFE", "DNA", "CODE"];

export default function HelixLab() {
  const [word, setWord] = useState("LIFE");
  const [mode, setMode] = useState<"knock" | "mutate">("knock");
  const [nucs, setNucs] = useState<Nuc[]>(() => buildStrand("LIFE"));
  const [history, setHistory] = useState<number[]>([1]);
  const [hovered, setHovered] = useState<number | null>(null);
  const raf = useRef(0);
  const last = useRef(0);
  const lastAcc = useRef(1);

  // changing the word rebuilds the molecule, so the two always move together
  const changeWord = useCallback((w: string) => {
    const next = w || "A";
    setWord(next);
    setNucs(buildStrand(next));
    setHistory([1]);
    lastAcc.current = 1;
  }, []);
  const reset = useCallback(() => changeWord(word), [changeWord, word]);

  /* ---- gravity ---------------------------------------------------------- */
  useEffect(() => {
    const tick = (t: number) => {
      const dt = Math.min(0.032, (t - (last.current || t)) / 1000);
      last.current = t;
      setNucs((prev) => {
        if (!prev.some((n) => !n.attached && !n.asleep)) return prev;
        return prev.map((n) => {
          if (n.attached || n.asleep) return n;
          const vel: Pos = [
            n.vel[0] * 0.995,
            n.vel[1] + GRAVITY * dt,
            n.vel[2] * 0.995,
          ];
          let pos: Pos = [
            n.pos[0] + vel[0] * dt,
            n.pos[1] + vel[1] * dt,
            n.pos[2] + vel[2] * dt,
          ];
          let asleep = false;
          if (pos[1] <= FLOOR) {
            pos = [pos[0], FLOOR, pos[2]];
            vel[1] = -vel[1] * BOUNCE;
            vel[0] *= 0.72;
            vel[2] *= 0.72;
            if (Math.abs(vel[1]) < 18) {
              vel[0] = vel[1] = vel[2] = 0;
              asleep = true;
            }
          }
          return { ...n, pos, vel, asleep };
        });
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  /* ---- what the strand now spells --------------------------------------- */
  const readout = useMemo(() => {
    const bits: number[] = [];
    for (const n of nucs) {
      if (!n.attached) continue; // the base is gone — everything after it shifts
      const v = VALUE[n.letter];
      bits.push((v >> 1) & 1, v & 1);
    }
    const text = bytesToText(bitArrayToBytes(bits));
    let ok = 0;
    const chars = word.split("").map((c, i) => {
      const got = text[i];
      if (got === c) ok++;
      return { want: c, got: got ?? "", ok: got === c };
    });
    const knocked = nucs.filter((n) => !n.attached).length;
    return {
      text,
      chars,
      accuracy: word.length ? ok / word.length : 1,
      knocked,
      mutated: nucs.filter((n) => n.mutated).length,
    };
  }, [nucs, word]);

  // record integrity whenever it changes
  useEffect(() => {
    if (readout.accuracy !== lastAcc.current) {
      lastAcc.current = readout.accuracy;
      setHistory((h) => [...h, readout.accuracy].slice(-60));
    }
  }, [readout.accuracy]);

  /* ---- interaction ------------------------------------------------------- */
  const act = (i: number) =>
    setNucs((prev) =>
      prev.map((n) => {
        if (n.i !== i) return n;
        if (mode === "mutate") {
          const v = (VALUE[n.letter] + 1 + Math.floor(Math.random() * 3)) % 4;
          return { ...n, letter: LETTER[v], mutated: LETTER[v] !== n.letter || n.mutated };
        }
        if (!n.attached) return n;
        return {
          ...n,
          attached: false,
          asleep: false,
          vel: [(Math.random() - 0.5) * 90, 40 + Math.random() * 40, (Math.random() - 0.5) * 90],
        };
      }),
    );

  /* ---- layers ------------------------------------------------------------ */
  const layers = useMemo(() => {
    const n = nucs.length;
    const backboneA: { s: Pos; t: Pos }[] = [];
    const backboneB: { s: Pos; t: Pos }[] = [];
    for (let i = 0; i < n - 1; i++) {
      backboneA.push({ s: seat(i, 0), t: seat(i + 1, 0) });
      backboneB.push({ s: seat(i, 1), t: seat(i + 1, 1) });
    }

    const rungs: { s: Pos; t: Pos }[] = nucs
      .filter((x) => x.attached)
      .map((x) => ({ s: x.pos, t: seat(x.i, 1) }));

    const partners: { pos: Pos; letter: Base; dim: boolean }[] = nucs.map((x) => ({
      pos: seat(x.i, 1),
      letter: PARTNER[x.letter],
      dim: !x.attached,
    }));

    const common = {
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    } as const;

    return [
      // the floor everything lands on
      new PolygonLayer<{ polygon: Pos[] }>({
        id: "floor",
        ...common,
        data: [
          {
            polygon: [
              [-150, FLOOR - 0.6, -150],
              [150, FLOOR - 0.6, -150],
              [150, FLOOR - 0.6, 150],
              [-150, FLOOR - 0.6, 150],
            ] as Pos[],
          },
        ],
        getPolygon: (d) => d.polygon,
        getFillColor: [22, 30, 41, 190],
        stroked: false,
        filled: true,
      }),

      new LineLayer({
        id: "backbone-a",
        ...common,
        data: backboneA,
        getSourcePosition: (d: { s: Pos }) => d.s,
        getTargetPosition: (d: { t: Pos }) => d.t,
        getColor: [125, 211, 252, 220],
        getWidth: 3,
      }),
      new LineLayer({
        id: "backbone-b",
        ...common,
        data: backboneB,
        getSourcePosition: (d: { s: Pos }) => d.s,
        getTargetPosition: (d: { t: Pos }) => d.t,
        getColor: [196, 181, 253, 220],
        getWidth: 3,
      }),
      new LineLayer({
        id: "rungs",
        ...common,
        data: rungs,
        getSourcePosition: (d: { s: Pos }) => d.s,
        getTargetPosition: (d: { t: Pos }) => d.t,
        getColor: [110, 128, 150, 170],
        getWidth: 1.5,
      }),

      // the complementary strand — always there, it is only the partner base
      new ScatterplotLayer({
        id: "partners",
        ...common,
        data: partners,
        getPosition: (d: { pos: Pos }) => d.pos,
        getFillColor: (d: { letter: Base; dim: boolean }) =>
          [...(BASE_RGB[d.letter] ?? [140, 150, 165]), d.dim ? 70 : 150] as [
            number,
            number,
            number,
            number,
          ],
        getRadius: 4.2,
        radiusUnits: "common",
        pickable: false,
      }),

      // your strand — these are the ones you can break
      new ScatterplotLayer({
        id: "bases",
        ...common,
        data: nucs,
        pickable: true,
        getPosition: (d: Nuc) => d.pos,
        getFillColor: (d: Nuc) =>
          (d.mutated
            ? [220, 38, 38, 255]
            : [...(BASE_RGB[d.letter] ?? [140, 150, 165]), d.attached ? 255 : 190]) as [
            number,
            number,
            number,
            number,
          ],
        getLineColor: [255, 255, 255, 220],
        getLineWidth: (d: Nuc) => (d.i === hovered ? 1.2 : 0),
        stroked: true,
        lineWidthUnits: "common",
        getRadius: (d: Nuc) => (d.i === hovered ? 7.6 : 6.2),
        radiusUnits: "common",
        updateTriggers: {
          getPosition: nucs,
          getFillColor: [nucs, hovered],
          getRadius: hovered,
          getLineWidth: hovered,
        },
      }),

      new TextLayer({
        id: "letters",
        ...common,
        data: nucs,
        getPosition: (d: Nuc) => d.pos,
        getText: (d: Nuc) => d.letter,
        getSize: 13,
        sizeUnits: "pixels",
        getColor: [8, 14, 22, 255],
        fontWeight: 700,
        getTextAnchor: "middle",
        getAlignmentBaseline: "center",
        billboard: true,
        updateTriggers: { getPosition: nucs, getText: nucs },
      }),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nucs, hovered, mode]);

  const knockedAll = readout.knocked;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5">
        <div>
          <h3 className="text-[16px] font-semibold text-ink">The helix, in your hands</h3>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            Drag to orbit, scroll to zoom. Click a base to break it and watch the word below.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            accent={ACCENT}
            value={mode}
            onChange={(v) => setMode(v as "knock" | "mutate")}
            options={[
              { value: "knock", label: "Knock it off" },
              { value: "mutate", label: "Change the letter" },
            ]}
          />
          <Button
            size="sm"
            variant="outline"
            accent={ACCENT}
            onClick={() => {
              const live = nucs.filter((n) => (mode === "knock" ? n.attached : true));
              if (live.length) act(live[Math.floor(Math.random() * live.length)].i);
            }}
          >
            <Zap size={13} /> Hit a random base
          </Button>
          <Button size="sm" variant="quiet" onClick={reset}>
            <RotateCcw size={13} /> Rebuild
          </Button>
        </div>
      </div>

      {/* the molecule */}
      <div className="relative h-[460px] bg-panel">
        <DeckGL
          views={new OrbitView({ orbitAxis: "Y", fovy: 46 })}
          initialViewState={{
            target: [0, (nucs.length * RISE) / 2, 0],
            rotationX: 8,
            rotationOrbit: 20,
            zoom: 1.05,
            minZoom: 0.5,
            maxZoom: 5,
          }}
          controller={{ dragPan: false }}
          layers={layers}
          pickingRadius={8}
          onClick={(info: PickingInfo) => {
            const d = info.object as Nuc | undefined;
            if (info.layer?.id === "bases" && d) act(d.i);
          }}
          onHover={(info: PickingInfo) => {
            const d = info.object as Nuc | undefined;
            setHovered(info.layer?.id === "bases" && d ? d.i : null);
          }}
          getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")}
          style={{ position: "absolute", inset: "0" }}
        />

        <div className="pointer-events-none absolute top-3 left-4 flex flex-col gap-1">
          <span className="eyebrow text-panel-ink-2">
            {mode === "knock" ? "click a base to snap it off" : "click a base to mutate it"}
          </span>
          <span className="mono text-[11px] text-panel-ink-2">
            {knockedAll} lost · {readout.mutated} mutated
          </span>
        </div>

        <div className="pointer-events-none absolute right-4 bottom-3 left-4">
          <div className="mono mb-1 text-[10px] tracking-[0.14em] text-panel-ink-2 uppercase">
            integrity
          </div>
          <Integrity history={history} accent={ACCENT} />
        </div>
      </div>

      {/* what it now spells */}
      <div className="px-5 py-5">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="eyebrow mb-1.5 text-ink-3">The word in the molecule</div>
            <div className="flex gap-1.5">
              {readout.chars.map((c, i) => (
                <div
                  key={i}
                  className="w-[46px] rounded-lg border px-1 py-1.5 text-center"
                  style={{
                    borderColor: c.ok ? "#15803d40" : "#dc262640",
                    background: c.ok ? "#15803d0d" : "#dc26260d",
                  }}
                >
                  <div
                    className="mono text-[18px] font-bold"
                    style={{ color: c.ok ? "#15803d" : "#dc2626" }}
                  >
                    {c.got === " " ? "␣" : c.got || "·"}
                  </div>
                  <div className="mono text-[9px] text-ink-3">{c.want}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Chip accent={readout.accuracy >= 0.999 ? "#15803d" : "#dc2626"} soft={false}>
              {Math.round(readout.accuracy * 100)}% intact
            </Chip>
            <input
              value={word}
              onChange={(e) =>
                changeWord(e.target.value.toUpperCase().replace(/[^A-Z ]/g, "").slice(0, 6))
              }
              className="mono w-[110px] rounded-lg border border-line bg-sunken px-3 py-2 text-[14px] text-ink outline-none focus:border-storage"
            />
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => changeWord(p)}
                className={cx(
                  "mono cursor-pointer rounded-md border px-2 py-1.5 text-[11px]",
                  word === p
                    ? "border-storage bg-storage-soft text-storage"
                    : "border-line text-ink-2 hover:bg-sunken",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t border-line-soft pt-5 sm:grid-cols-2">
          <div className="flex gap-3">
            <Hammer size={16} className="mt-0.5 shrink-0 text-ink-3" />
            <p className="text-[13px] leading-[1.6] text-ink-2">
              <strong className="text-ink">Knocking a base off</strong> does not just lose one
              letter. The bases after it all slide up one seat, so every pair after the gap is
              read in the wrong place — one missing base can scramble the entire rest of the
              word. That is a frame shift, and it is the single most destructive thing that can
              happen to a strand.
            </p>
          </div>
          <div className="flex gap-3">
            <Shuffle size={16} className="mt-0.5 shrink-0 text-ink-3" />
            <p className="text-[13px] leading-[1.6] text-ink-2">
              <strong className="text-ink">Changing a letter</strong> is far gentler. The strand
              stays the right length, so only the characters that base helps spell go wrong.
              Switch modes and compare: mutate four bases and the word is usually still
              readable; knock one off and it rarely is.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
