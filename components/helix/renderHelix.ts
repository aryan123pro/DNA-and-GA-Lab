/**
 * ---------------------------------------------------------------------------
 *  Drawing the molecule.
 * ---------------------------------------------------------------------------
 *  A small 3-D engine on a 2-D canvas: every primitive is projected with real
 *  perspective, depth-sorted and painted back to front, so backbones pass
 *  behind and in front of each other and enzymes really wrap around the
 *  helix. Proportions are B-DNA's: 20 Å across, 3.4 Å per base pair, ten and
 *  a half pairs per turn, and the two strands 137° apart around the axis,
 *  which is what gives DNA its major and minor grooves.
 *
 *  It never changes the model. It reads the Helix, drains its event queue
 *  into short-lived particles, and draws.
 * ---------------------------------------------------------------------------
 */

import { Base } from "@/lib/dna";
import { COMPLEMENT, Helix, Job, LESION_INFO, PATHWAY_INFO, Site, enzymeAt } from "@/lib/helix";

/* -------------------------------------------------------------------------- */
/* geometry                                                                   */
/* -------------------------------------------------------------------------- */

const R = 10; // Å, backbone radius
const RISE = 3.4; // Å per base pair
const TWIST = (Math.PI * 2) / 10.5; // per base pair
const GROOVE = 2.39; // rad between the two strands' backbones (137°)
const CAM = 190; // Å from the axis to the camera

export const BASE_HEX: Record<Base, string> = {
  A: "#3b82f6",
  C: "#f97316",
  G: "#22c55e",
  T: "#a855f7",
};
const STRAND_TOP = "#5eead4";
const STRAND_BOTTOM = "#a5b4fc";
const PHOSPHATE = "#fbbf24";

type V3 = [number, number, number];

export interface View {
  yaw: number;
  pitch: number;
  zoom: number;
  /** the molecule's own rotation about its axis */
  spin: number;
}

export interface Pick {
  /** the site under the pointer, or null */
  id: number | null;
  x: number;
  y: number;
}

/** Everything that lives only on screen. */
export interface RenderMemory {
  /** displayed position along the strand, so a splice slides shut instead of jumping */
  disp: Map<number, number>;
  particles: Particle[];
  flashes: Flash[];
  floats: Float[];
  motes: { x: number; y: number; z: number; r: number; s: number }[];
  shake: number;
  lastT: number;
}

interface Particle {
  p: V3;
  v: V3;
  spin: number;
  rot: number;
  life: number;
  age: number;
  color: string;
  size: number;
  kind: "base" | "spark";
}
interface Flash {
  p: V3;
  color: string;
  age: number;
  life: number;
  size: number;
  kind: "glow" | "ring" | "beam" | "bolt";
  from?: V3;
  seed: number;
}
interface Float {
  p: V3;
  text: string;
  color: string;
  age: number;
}

export function makeMemory(): RenderMemory {
  const motes = Array.from({ length: 70 }, (_, i) => {
    const r = (n: number) => {
      const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    return { x: r(1), y: r(2), z: r(3), r: 0.4 + r(4) * 1.6, s: 0.2 + r(5) };
  });
  return {
    disp: new Map(),
    particles: [],
    flashes: [],
    floats: [],
    motes,
    shake: 0,
    lastT: 0,
  };
}

/* -------------------------------------------------------------------------- */
/* sprites                                                                    */
/* -------------------------------------------------------------------------- */

const sprites = new Map<string, HTMLCanvasElement>();

/** A shaded sphere: lit from the upper left, with a rim and a soft shadow side. */
function ball(hex: string): HTMLCanvasElement {
  const key = `ball${hex}`;
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(24, 22, 2, 32, 32, 31);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.18, mix(hex, "#ffffff", 0.45));
  grad.addColorStop(0.6, hex);
  grad.addColorStop(1, mix(hex, "#000000", 0.6));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(32, 32, 31, 0, Math.PI * 2);
  g.fill();
  sprites.set(key, c);
  return c;
}

function glow(rgb: string): HTMLCanvasElement {
  const key = `glow${rgb}`;
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.3, `rgba(${rgb},0.55)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  sprites.set(key, c);
  return c;
}

function hexRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}
function rgbStr(hex: string) {
  return hexRgb(hex).join(",");
}
function mix(a: string, b: string, k: number) {
  const x = hexRgb(a);
  const y = hexRgb(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const BG = "#070d16";

/* -------------------------------------------------------------------------- */
/* the frame                                                                  */
/* -------------------------------------------------------------------------- */

interface Projected {
  x: number;
  y: number;
  z: number;
  s: number;
}

type DrawItem = { z: number; fn: () => void };

export interface DrawInput {
  helix: Helix;
  view: View;
  /** the site under the pointer */
  hover: number | null;
  /** what clicking would do, for the hover tip */
  toolLabel: string | null;
  toolColor: string;
  /** wall-clock seconds, for things that should move even when paused */
  wall: number;
  reduced: boolean;
}

export function drawHelix(
  ctx: CanvasRenderingContext2D,
  size: { w: number; h: number; dpr: number },
  input: DrawInput,
  mem: RenderMemory,
  pick: Pick,
) {
  const { w: W, h: H, dpr } = size;
  if (W < 2 || H < 2) return;
  const { helix: hx, view, wall, reduced } = input;
  const dtWall = Math.min(0.05, Math.max(0, wall - (mem.lastT || wall)));
  mem.lastT = wall;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  /* ---- background: deep water, with drifting motes ---------------------- */
  const bg = ctx.createRadialGradient(
    W * 0.5,
    H * 0.45,
    10,
    W * 0.5,
    H * 0.5,
    Math.max(W, H) * 0.75,
  );
  bg.addColorStop(0, "#10213a");
  bg.addColorStop(0.55, "#0a1526");
  bg.addColorStop(1, BG);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  for (const m of mem.motes) {
    const drift = reduced ? 0 : wall * 6 * m.s;
    const x = (((m.x * W + drift + view.yaw * 40 * m.z) % W) + W) % W;
    const y = (((m.y * H + Math.sin(wall * 0.3 + m.x * 9) * 6) % H) + H) % H;
    ctx.globalAlpha = 0.12 + m.z * 0.25;
    ctx.fillStyle = "#93c5fd";
    ctx.beginPath();
    ctx.arc(x, y, m.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* ---- layout ------------------------------------------------------------ */
  const n = hx.sites.length;
  const breakIdx = hx.breakAfter === null ? -1 : hx.sites.findIndex((s) => s.id === hx.breakAfter);
  const gap = 14 * hx.breakOpen;

  // smoothed display index per site, so splices slide shut
  const seen = new Set<number>();
  hx.sites.forEach((s, i) => {
    seen.add(s.id);
    const d = mem.disp.get(s.id);
    mem.disp.set(s.id, d === undefined ? i : d + (i - d) * (1 - Math.exp(-6 * dtWall)));
  });
  for (const k of mem.disp.keys()) if (!seen.has(k)) mem.disp.delete(k);

  const length = Math.max(1, n - 1) * RISE + gap;
  const scale = (Math.min(W * 0.86, H * 2.4) / (length + 26)) * view.zoom;

  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);
  const shakeX = mem.shake * Math.sin(wall * 70);
  const shakeY = mem.shake * Math.cos(wall * 55);
  mem.shake = Math.max(0, mem.shake - dtWall * 18);
  const ox = W / 2 + shakeX;
  const oy = H * 0.47 + shakeY;

  const project = (p: V3): Projected => {
    const x1 = p[0] * cy + p[2] * sy;
    const z1 = -p[0] * sy + p[2] * cy;
    const y2 = p[1] * cp - z1 * sp;
    const z2 = p[1] * sp + z1 * cp;
    const s = CAM / (CAM - z2);
    return { x: ox + x1 * scale * s, y: oy - y2 * scale * s, z: z2, s: scale * s };
  };

  /** world x of a fractional index along the strand, with the break pulled apart */
  const xAt = (k: number) => {
    let x = (k - (n - 1) / 2) * RISE - gap / 2;
    if (breakIdx >= 0 && k > breakIdx + 0.5) x += gap;
    return x;
  };
  const sag = (k: number) => (breakIdx >= 0 ? (k > breakIdx + 0.5 ? -2.2 : 2.2) * hx.breakOpen : 0);

  const angle = (k: number) => k * TWIST + view.spin;
  const bubbleSet = new Set(hx.bubble);

  /** backbone positions for a site at fractional index k */
  const topAt = (k: number, push = 0): V3 => {
    const a = angle(k);
    const r = R + push;
    return [xAt(k), Math.cos(a) * r + sag(k), Math.sin(a) * r];
  };
  const botAt = (k: number): V3 => {
    const a = angle(k) + GROOVE;
    return [xAt(k), Math.cos(a) * R + sag(k), Math.sin(a) * R];
  };

  const items: DrawItem[] = [];
  const fog = (z: number) => Math.max(0, Math.min(1, (z + 26) / 52)); // 0 far, 1 near

  /* ---- the sister chromatid, for homologous recombination ---------------- */
  if (hx.sister > 0.02) {
    const off: V3 = [0, -34, -18];
    const a = hx.sister;
    for (let k = 0; k < n - 1; k++) {
      for (const strand of [0, 1]) {
        const ang0 = k * TWIST + view.spin * 0.6 + (strand ? GROOVE : 0);
        const ang1 = ang0 + TWIST;
        const p0 = project([
          xAt(k) + off[0],
          Math.cos(ang0) * R + off[1],
          Math.sin(ang0) * R + off[2],
        ]);
        const p1 = project([
          xAt(k + 1) + off[0],
          Math.cos(ang1) * R + off[1],
          Math.sin(ang1) * R + off[2],
        ]);
        items.push({
          z: (p0.z + p1.z) / 2,
          fn: () => {
            ctx.strokeStyle = `rgba(148,163,184,${(0.45 * a).toFixed(3)})`;
            ctx.lineWidth = 2 * p0.s;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
          },
        });
      }
    }
    // the invading strand reaching across to read the template
    if (breakIdx >= 0 && a > 0.3) {
      const from = project(topAt(breakIdx + 0.5));
      const to = project([xAt(breakIdx + 0.5), off[1] + R * 0.6, off[2]]);
      items.push({
        z: 30,
        fn: () => {
          ctx.strokeStyle = `rgba(34,211,238,${(0.7 * a).toFixed(3)})`;
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.quadraticCurveTo((from.x + to.x) / 2 + 30, (from.y + to.y) / 2, to.x, to.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = `rgba(165,243,252,${a.toFixed(3)})`;
          ctx.font = "700 10px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.fillText("SISTER CHROMATID — the template", to.x, to.y + 30 * (to.s / scale));
        },
      });
    }
  }

  /* ---- backbones --------------------------------------------------------- */
  const SUB = 4;
  const tube = (p0: Projected, p1: Projected, hex: string, width: number, alpha = 1) => {
    const f = fog((p0.z + p1.z) / 2);
    const col = mix(BG, hex, 0.35 + 0.65 * f);
    items.push({
      z: (p0.z + p1.z) / 2,
      fn: () => {
        ctx.globalAlpha = alpha;
        // one solid body stroke and an offset highlight: overlapping segments
        // blend into a continuous tube instead of a string of beads
        ctx.lineCap = "round";
        ctx.strokeStyle = mix(col, "#000000", 0.12);
        ctx.lineWidth = width * p0.s;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        ctx.strokeStyle = mix(col, "#ffffff", 0.18);
        ctx.lineWidth = width * 0.45 * p0.s;
        ctx.beginPath();
        ctx.moveTo(p0.x - width * 0.12 * p0.s, p0.y - width * 0.14 * p0.s);
        ctx.lineTo(p1.x - width * 0.12 * p0.s, p1.y - width * 0.14 * p0.s);
        ctx.stroke();
        ctx.strokeStyle = mix(col, "#ffffff", 0.6);
        ctx.lineWidth = width * 0.14 * p0.s;
        ctx.beginPath();
        ctx.moveTo(p0.x - width * 0.22 * p0.s, p0.y - width * 0.26 * p0.s);
        ctx.lineTo(p1.x - width * 0.22 * p0.s, p1.y - width * 0.26 * p0.s);
        ctx.stroke();
        ctx.globalAlpha = 1;
      },
    });
  };

  const dispOf = (s: Site) => mem.disp.get(s.id) ?? hx.sites.indexOf(s);

  for (let i = 0; i < n - 1; i++) {
    const s = hx.sites[i];
    const next = hx.sites[i + 1];
    const k0 = dispOf(s);
    const k1 = dispOf(next);
    const broken = hx.breakAfter === s.id;
    const nicked = hx.nicks.has(s.id);
    const topGone = s.gone || next.gone;
    for (let q = 0; q < SUB; q++) {
      const a = k0 + ((k1 - k0) * q) / SUB;
      const b = k0 + ((k1 - k0) * (q + 1)) / SUB;
      // where the backbone is cut, leave a real hole
      const inGap = q === SUB - 1 || q === SUB - 2;
      if (!(broken && inGap) && !(nicked && q === SUB - 1) && !topGone) {
        const pushA = bubbleSet.has(s.id) ? 7 * hx.bubbleOpen : 0;
        const pushB = bubbleSet.has(next.id) ? 7 * hx.bubbleOpen : 0;
        tube(
          project(topAt(a, pushA + (pushB - pushA) * (q / SUB))),
          project(topAt(b, pushA + (pushB - pushA) * ((q + 1) / SUB))),
          STRAND_TOP,
          2.6,
        );
      }
      if (!(broken && inGap) && !topGone) {
        tube(project(botAt(a)), project(botAt(b)), STRAND_BOTTOM, 2.6);
      }
    }
    // frayed, glowing ends at a nick or a break
    if (nicked || broken) {
      const p = project(topAt(k0 + (k1 - k0) * 0.6));
      items.push({
        z: p.z + 0.5,
        fn: () => {
          ctx.globalCompositeOperation = "lighter";
          const pulse = reduced ? 0.8 : 0.6 + 0.4 * Math.sin(wall * 8);
          const g = glow(broken ? "255,255,255" : "250,204,21");
          const r = (broken ? 5 : 3) * p.s * pulse;
          ctx.globalAlpha = 0.85;
          ctx.drawImage(g, p.x - r, p.y - r, r * 2, r * 2);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        },
      });
    }
  }

  /* ---- base pairs -------------------------------------------------------- */
  const pickCandidates: { id: number; x: number; y: number }[] = [];

  hx.sites.forEach((s, i) => {
    const k = dispOf(s);
    const bub = bubbleSet.has(s.id) ? hx.bubbleOpen : 0;
    const mismatch = s.present && !s.lesion && s.letter !== s.truth;
    const push = 7 * bub + (mismatch ? 2.6 : 0);
    const pt = topAt(k, push);
    const pb = botAt(k);
    const mid: V3 = [
      (topAt(k)[0] + pb[0]) / 2,
      (topAt(k)[1] + pb[1]) / 2,
      (topAt(k)[2] + pb[2]) / 2,
    ];
    const age = hx.t - s.fresh;

    // a freshly inserted base swims in from solution
    let inbound = 1;
    let topEnd: V3 = pt;
    if (age >= 0 && age < 0.5 && s.present) {
      inbound = age / 0.5;
      const e = 1 - Math.pow(1 - inbound, 3);
      const a = angle(k);
      const far: V3 = [pt[0], Math.cos(a) * 32 + 8, Math.sin(a) * 32];
      topEnd = [
        far[0] + (pt[0] - far[0]) * e,
        far[1] + (pt[1] - far[1]) * e,
        far[2] + (pt[2] - far[2]) * e,
      ];
    }

    const PT = project(topEnd);
    const PB = project(pb);
    const PM = project(mid);
    const partner = COMPLEMENT[s.truth];

    // bottom half: the template, almost always there
    if (!s.gone) {
      items.push({
        z: (PB.z + PM.z) / 2,
        fn: () => slab(ctx, PB, PM, BASE_HEX[partner], fog((PB.z + PM.z) / 2), 1, partner, false),
      });
      items.push({ z: PB.z + 0.3, fn: () => atom(ctx, PB, PHOSPHATE, 1.05, fog(PB.z)) });
    }

    if (s.gone) return;
    items.push({ z: PT.z + 0.3, fn: () => atom(ctx, project(pt), PHOSPHATE, 1.05, fog(PT.z)) });

    if (!s.present) {
      // an empty seat: the sugar is there, the base is not
      items.push({
        z: (PT.z + PM.z) / 2,
        fn: () => {
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = "rgba(250,204,21,0.55)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(PT.x, PT.y);
          ctx.lineTo(PT.x + (PM.x - PT.x) * 0.85, PT.y + (PM.y - PT.y) * 0.85);
          ctx.stroke();
          ctx.setLineDash([]);
        },
      });
    } else {
      // a base pushed out of a bubble or bulge does not reach its partner
      const reach = bub > 0.05 ? 0.55 : mismatch ? 0.8 : 1;
      const end: Projected = {
        x: PT.x + (PM.x - PT.x) * reach,
        y: PT.y + (PM.y - PT.y) * reach,
        z: PT.z + (PM.z - PT.z) * reach,
        s: PM.s,
      };
      const lesion = s.lesion;
      const color =
        lesion === "dimer"
          ? mix(BASE_HEX[s.letter], "#a855f7", 0.55)
          : lesion === "oxo"
            ? mix(BASE_HEX[s.letter], "#ef4444", 0.6)
            : BASE_HEX[s.letter];
      const zz = (PT.z + end.z) / 2;
      items.push({
        z: zz,
        fn: () => {
          slab(
            ctx,
            PT,
            end,
            color,
            fog(zz),
            Math.min(1, 0.4 + inbound),
            s.letter,
            reach === 1 && !lesion,
          );
          // hydrogen bonds: two for A·T, three for C·G
          if (reach === 1 && !lesion && end.s > 2.2) {
            const bonds = s.letter === "C" || s.letter === "G" ? 3 : 2;
            ctx.fillStyle = `rgba(255,255,255,${(0.35 + 0.5 * fog(zz)).toFixed(3)})`;
            const dx = PB.x - PT.x;
            const dy = PB.y - PT.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            for (let b = 0; b < bonds; b++) {
              const off = (b - (bonds - 1) / 2) * 1.1 * end.s * 0.5;
              ctx.beginPath();
              ctx.arc(
                PM.x + nx * off,
                PM.y + ny * off,
                Math.max(0.7, end.s * 0.22),
                0,
                Math.PI * 2,
              );
              ctx.fill();
            }
          }
        },
      });

      // damage glows
      const hot = lesion === "oxo" || mismatch || lesion === "dimer";
      if (hot) {
        const tint =
          lesion === "oxo" ? "244,63,94" : lesion === "dimer" ? "168,85,247" : "251,146,60";
        const c: Projected = {
          x: (PT.x + end.x) / 2,
          y: (PT.y + end.y) / 2,
          z: zz,
          s: PT.s,
        };
        items.push({
          z: zz + 0.2,
          fn: () => {
            const pulse = reduced ? 0.8 : 0.65 + 0.35 * Math.sin(wall * 5 + s.id);
            ctx.globalCompositeOperation = "lighter";
            const r = 6 * c.s * pulse;
            ctx.globalAlpha = 0.8;
            ctx.drawImage(glow(tint), c.x - r, c.y - r, r * 2, r * 2);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
          },
        });
      }
      // freshly written: a short cyan shimmer
      if (age >= 0 && age < 1.6) {
        items.push({
          z: zz + 0.3,
          fn: () => {
            ctx.globalCompositeOperation = "lighter";
            const r = 5 * PT.s;
            ctx.globalAlpha = 0.9 * (1 - age / 1.6);
            ctx.drawImage(
              glow("103,232,249"),
              (PT.x + end.x) / 2 - r,
              (PT.y + end.y) / 2 - r,
              r * 2,
              r * 2,
            );
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
          },
        });
      }
      // a permanent mutation keeps a small scar
      if (s.permanent) {
        items.push({
          z: PT.z + 0.4,
          fn: () => {
            ctx.strokeStyle = "rgba(248,113,113,0.95)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(PT.x, PT.y, 2.6 * PT.s, 0, Math.PI * 2);
            ctx.stroke();
          },
        });
      }
    }

    // the welded bond between a dimer's two bases
    const nextSite = hx.sites[i + 1];
    if (s.lesion === "dimer" && nextSite?.lesion === "dimer" && s.present && nextSite.present) {
      const a = project(topAt(k, 0));
      const b = project(topAt(dispOf(nextSite), 0));
      const am = project(mid);
      items.push({
        z: (a.z + b.z) / 2 + 0.5,
        fn: () => {
          ctx.strokeStyle = "rgba(216,180,254,0.95)";
          ctx.lineWidth = 2.2;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(a.x + (am.x - a.x) * 0.45, a.y + (am.y - a.y) * 0.45);
          ctx.lineTo(b.x + (am.x - a.x) * 0.45, b.y + (am.y - a.y) * 0.45);
          ctx.stroke();
          ctx.setLineDash([]);
        },
      });
    }

    pickCandidates.push({ id: s.id, x: (PT.x + PM.x) / 2, y: (PT.y + PM.y) / 2 });
  });

  /* ---- enzymes ----------------------------------------------------------- */
  const labels: (() => void)[] = [];
  for (const job of hx.jobs) {
    if (job.done) continue;
    const st = job.steps[job.step];
    if (!st?.enzyme) continue;
    const e = st.enzyme;
    const at = enzymeAt(hx, job);
    const x = xAt(at);
    const wob = reduced ? 0 : Math.sin(wall * 3 + job.id) * 0.8;
    const info = PATHWAY_INFO[job.pathway];

    if (e.shape === "clamp") {
      // a ring of protein around the double helix
      const ringR = R + 5.5;
      const N = 16;
      for (let q = 0; q < N; q++) {
        const a = (q / N) * Math.PI * 2 + (reduced ? 0 : wall * 0.6);
        const p = project([
          x + Math.sin(a * 2) * 0.6,
          Math.cos(a) * ringR + wob,
          Math.sin(a) * ringR,
        ]);
        items.push({ z: p.z, fn: () => atom(ctx, p, e.color, 3.3, 0.6 + 0.4 * fog(p.z)) });
      }
      // NHEJ holds both ends: a second ring across the break
      if (job.pathway === "NHEJ" && breakIdx >= 0) {
        const x2 = xAt(breakIdx + 1);
        for (let q = 0; q < N; q++) {
          const a = (q / N) * Math.PI * 2 - (reduced ? 0 : wall * 0.6);
          const p = project([x2, Math.cos(a) * ringR, Math.sin(a) * ringR]);
          items.push({ z: p.z, fn: () => atom(ctx, p, e.color, 3.3, 0.6 + 0.4 * fog(p.z)) });
        }
      }
    } else {
      // a globular protein sitting in the groove: a few overlapping lobes
      // seated on the upper flank so the base it is working on stays in view
      const lobes: [V3, number][] = [
        [[0, 0, 0], 4.4],
        [[3.4, 2.2, -1.5], 3.2],
        [[-3, 1.8, 0.8], 3],
        [[0.6, 4, 1.2], 2.6],
        [[-1.4, -1.8, 2.2], 2.3],
      ];
      const centre: V3 = [x, R + 4.5 + wob, 3];
      for (const [o, r] of lobes) {
        const p = project([centre[0] + o[0], centre[1] + o[1], centre[2] + o[2]]);
        items.push({ z: p.z, fn: () => atom(ctx, p, e.color, r, 0.82) });
      }
      // a beam from the enzyme down to the base it is handling
      const tgt = project([x, R * 0.6, R * 0.4]);
      const top = project(centre);
      items.push({
        z: 40,
        fn: () => {
          ctx.globalCompositeOperation = "lighter";
          const grad = ctx.createLinearGradient(top.x, top.y, tgt.x, tgt.y);
          grad.addColorStop(0, `rgba(${rgbStr(e.color)},0.45)`);
          grad.addColorStop(1, `rgba(${rgbStr(e.color)},0)`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(tgt.x, tgt.y);
          ctx.stroke();
          ctx.globalCompositeOperation = "source-over";
        },
      });
    }

    // a label above the enzyme, saying who it is and what it is doing
    const anchor = project([x, R + 12, 3]);
    labels.push(() => {
      const name = e.name;
      const sub = `${info.short} · ${st.title.toLowerCase()}`;
      ctx.font = "700 11px ui-sans-serif, system-ui, sans-serif";
      const w1 = ctx.measureText(name).width;
      ctx.font = "600 9.5px ui-monospace, monospace";
      const w2 = ctx.measureText(sub).width;
      const bw = Math.max(w1, w2) + 16;
      const bx = Math.max(6, Math.min(W - bw - 6, anchor.x - bw / 2));
      // kept clear of the word readout and the crew list in the corners
      const by = Math.max(84, anchor.y - 44);
      ctx.fillStyle = "rgba(8,14,24,0.82)";
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 1;
      roundRect(ctx, bx, by, bw, 32, 7);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(anchor.x, by + 32);
      ctx.lineTo(anchor.x, anchor.y);
      ctx.strokeStyle = `rgba(${rgbStr(e.color)},0.5)`;
      ctx.stroke();
      ctx.fillStyle = e.color;
      ctx.font = "700 11px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(name, bx + 8, by + 14);
      ctx.fillStyle = "rgba(203,213,225,0.85)";
      ctx.font = "600 9.5px ui-monospace, monospace";
      ctx.fillText(sub, bx + 8, by + 26);
    });
  }

  /* ---- events become particles ----------------------------------------- */
  const posOf = (id: number): V3 | null => {
    const s = hx.sites.find((x) => x.id === id);
    if (!s) return null;
    return topAt(dispOf(s));
  };
  for (const ev of hx.events) {
    if (ev.type === "pop") {
      const p = posOf(ev.id);
      if (!p) continue;
      const out: V3 = [p[0] * 0, p[1] * 0.12, p[2] * 0.12];
      const pieces = ev.strand === "both" ? 2 : 1;
      for (let q = 0; q < pieces; q++) {
        mem.particles.push({
          p: [p[0], p[1], p[2]],
          v: [(Math.random() - 0.5) * 10, out[1] * 30 + 14 + q * 4, out[2] * 30 + 6],
          spin: (Math.random() - 0.5) * 10,
          rot: Math.random() * 6,
          life: 2.2,
          age: 0,
          color:
            q === 0
              ? ev.damaged
                ? mix(BASE_HEX[ev.letter], "#ef4444", 0.5)
                : BASE_HEX[ev.letter]
              : BASE_HEX[COMPLEMENT[ev.letter]],
          size: 3.2,
          kind: "base",
        });
      }
    } else if (ev.type === "insert") {
      const p = posOf(ev.id);
      if (p)
        mem.flashes.push({
          p,
          color: "103,232,249",
          age: 0,
          life: 0.7,
          size: 7,
          kind: "ring",
          seed: ev.id,
        });
    } else if (ev.type === "seal") {
      const p = posOf(ev.id);
      if (p)
        mem.flashes.push({
          p,
          color: "163,230,53",
          age: 0,
          life: 0.9,
          size: 10,
          kind: "ring",
          seed: ev.id,
        });
    } else if (ev.type === "hit") {
      const p = posOf(ev.id);
      if (!p) continue;
      const col = rgbStr(LESION_INFO[ev.kind].color);
      if (ev.kind === "dimer") {
        mem.flashes.push({
          p,
          from: [p[0] + 60, p[1] + 90, p[2] + 40],
          color: "192,132,252",
          age: 0,
          life: 0.6,
          size: 8,
          kind: "beam",
          seed: ev.id,
        });
      } else if (ev.kind === "break") {
        mem.flashes.push({
          p,
          color: "255,255,255",
          age: 0,
          life: 0.5,
          size: 14,
          kind: "bolt",
          seed: ev.id,
        });
        if (!reduced) mem.shake = 6;
      } else if (ev.kind === "oxo") {
        for (let q = 0; q < 10; q++) {
          mem.particles.push({
            p: [...p] as V3,
            v: [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30],
            spin: 0,
            rot: 0,
            life: 0.6,
            age: 0,
            color: "#fb7185",
            size: 0.7,
            kind: "spark",
          });
        }
      }
      mem.flashes.push({ p, color: col, age: 0, life: 0.6, size: 9, kind: "glow", seed: ev.id });
      mem.floats.push({
        // below the strand, so it never sits on an arriving enzyme's label
        p: [p[0], -R - 3, p[2]],
        text: LESION_INFO[ev.kind].name,
        color: LESION_INFO[ev.kind].color,
        age: 0,
      });
    } else if (ev.type === "fixed") {
      const p = posOf(ev.id) ?? [0, 0, 0];
      mem.floats.push({
        p: [p[0], p[1] + 16, p[2]],
        text: ev.exact ? "repaired ✓" : "joined — bases lost",
        color: ev.exact ? "#4ade80" : "#fbbf24",
        age: 0,
      });
    } else if (ev.type === "mutation") {
      const p = posOf(ev.id);
      if (!p) continue;
      mem.flashes.push({
        p,
        color: "248,113,113",
        age: 0,
        life: 1.0,
        size: 10,
        kind: "ring",
        seed: ev.id,
      });
      mem.floats.push({
        p: [p[0], p[1] + 14, p[2]],
        text: "copied wrong — permanent",
        color: "#f87171",
        age: 0,
      });
    }
  }
  hx.events.length = 0;

  /* ---- particles --------------------------------------------------------- */
  for (const pt of mem.particles) {
    pt.age += dtWall;
    pt.v[1] -= (pt.kind === "base" ? 30 : 0) * dtWall;
    pt.p[0] += pt.v[0] * dtWall;
    pt.p[1] += pt.v[1] * dtWall;
    pt.p[2] += pt.v[2] * dtWall;
    pt.rot += pt.spin * dtWall;
    const pr = project(pt.p);
    const a = Math.max(0, 1 - pt.age / pt.life);
    if (pt.kind === "base") {
      items.push({
        z: pr.z,
        fn: () => {
          ctx.save();
          ctx.translate(pr.x, pr.y);
          ctx.rotate(pt.rot);
          ctx.globalAlpha = a;
          ctx.fillStyle = pt.color;
          roundRect(
            ctx,
            -pt.size * pr.s * 0.5,
            -pt.size * pr.s * 0.18,
            pt.size * pr.s,
            pt.size * pr.s * 0.36,
            2,
          );
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.restore();
        },
      });
    } else {
      items.push({
        z: pr.z,
        fn: () => {
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = a;
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, Math.max(0.8, pt.size * pr.s), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        },
      });
    }
  }
  mem.particles = mem.particles.filter((p) => p.age < p.life);

  /* ---- paint, back to front ------------------------------------------- */
  items.sort((a, b) => a.z - b.z);
  for (const it of items) it.fn();

  /* ---- the replication fork -------------------------------------------- */
  if (hx.fork >= 0) {
    const fx = xAt(hx.fork * (n - 1));
    const a = project([fx, R + 14, 0]);
    const b = project([fx, -R - 14, 0]);
    const g = ctx.createLinearGradient(a.x - 40, 0, a.x + 10, 0);
    g.addColorStop(0, "rgba(56,189,248,0)");
    g.addColorStop(1, "rgba(56,189,248,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(a.x - 40, a.y, 50, b.y - a.y);
    ctx.strokeStyle = "rgba(125,211,252,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x + 10, a.y);
    ctx.lineTo(b.x + 10, b.y);
    ctx.stroke();
    ctx.fillStyle = "#7dd3fc";
    ctx.font = "800 10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("REPLICATION FORK", a.x + 10, a.y - 6);
  }

  /* ---- flashes --------------------------------------------------------- */
  ctx.globalCompositeOperation = "lighter";
  for (const f of mem.flashes) {
    f.age += dtWall;
    const k = f.age / f.life;
    if (k >= 1) continue;
    const p = project(f.p);
    if (f.kind === "glow") {
      const r = f.size * p.s * (0.6 + k);
      ctx.globalAlpha = 1 - k;
      ctx.drawImage(glow(f.color), p.x - r, p.y - r, r * 2, r * 2);
    } else if (f.kind === "ring") {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = `rgb(${f.color})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, f.size * p.s * (0.3 + k), 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.kind === "beam" && f.from) {
      const q = project(f.from);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = `rgb(${f.color})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      // ultraviolet as a wave
      const steps = 18;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const x = q.x + (p.x - q.x) * u;
        const y = q.y + (p.y - q.y) * u + Math.sin(u * 30 - f.age * 40) * 4;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (f.kind === "bolt") {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = "rgb(255,255,255)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let x = p.x - 4;
      let y = p.y - 70;
      ctx.moveTo(x, y);
      for (let i = 0; i < 7; i++) {
        x += Math.sin(f.seed * 13 + i * 7.3) * 12;
        y += 20;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      const r = f.size * p.s * (1 + k);
      ctx.drawImage(glow("255,255,255"), p.x - r, p.y - r, r * 2, r * 2);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  mem.flashes = mem.flashes.filter((f) => f.age < f.life);

  /* ---- labels and floating captions ------------------------------------ */
  for (const l of labels) l();

  for (const fl of mem.floats) {
    fl.age += dtWall;
    const p = project(fl.p);
    const a = fl.age < 0.2 ? fl.age / 0.2 : Math.max(0, 1 - (fl.age - 1.2) / 0.6);
    ctx.globalAlpha = a;
    ctx.font = "800 11px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText(fl.text, p.x + 1, p.y - fl.age * 18 + 1);
    ctx.fillStyle = fl.color;
    ctx.fillText(fl.text, p.x, p.y - fl.age * 18);
  }
  ctx.globalAlpha = 1;
  mem.floats = mem.floats.filter((f) => f.age < 1.8);

  /* ---- picking, and the hover tip -------------------------------------- */
  let best: number | null = null;
  let bestD = 16;
  for (const c of pickCandidates) {
    const d = Math.hypot(c.x - pick.x, c.y - pick.y);
    if (d < bestD) {
      bestD = d;
      best = c.id;
    }
  }
  pick.id = best;

  if (input.hover !== null) {
    const c = pickCandidates.find((p) => p.id === input.hover);
    const s = hx.sites.find((x) => x.id === input.hover);
    if (c && s) {
      ctx.strokeStyle = input.toolColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
      ctx.stroke();
      const idx = hx.sites.indexOf(s);
      const state = !s.present
        ? "empty seat"
        : s.lesion === "oxo"
          ? "oxidised"
          : s.lesion === "dimer"
            ? "UV dimer"
            : s.letter !== s.truth
              ? `mismatch (${s.letter}·${COMPLEMENT[s.truth]})`
              : s.permanent
                ? "mutated — both strands agree"
                : `${s.letter}·${COMPLEMENT[s.truth]} pair`;
      const line1 = `base ${idx + 1} · ${state}`;
      const line2 = input.toolLabel ?? "";
      ctx.font = "700 11px ui-monospace, monospace";
      const w = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 16;
      const bx = Math.min(W - w - 6, c.x + 14);
      const by = Math.max(6, c.y - 44);
      ctx.fillStyle = "rgba(8,14,24,0.9)";
      roundRect(ctx, bx, by, w, line2 ? 36 : 22, 6);
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText(line1, bx + 8, by + 15);
      if (line2) {
        ctx.fillStyle = input.toolColor;
        ctx.fillText(line2, bx + 8, by + 29);
      }
    }
  }

  // vignette
  const v = ctx.createRadialGradient(
    W / 2,
    H / 2,
    Math.min(W, H) * 0.35,
    W / 2,
    H / 2,
    Math.max(W, H) * 0.72,
  );
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

/* -------------------------------------------------------------------------- */
/* primitives                                                                 */
/* -------------------------------------------------------------------------- */

function atom(ctx: CanvasRenderingContext2D, p: Projected, hex: string, r: number, alpha: number) {
  const rr = Math.max(0.6, r * p.s);
  ctx.globalAlpha = alpha;
  ctx.drawImage(ball(hex), p.x - rr, p.y - rr, rr * 2, rr * 2);
  ctx.globalAlpha = 1;
}

/** One half of a base pair: a flat, rounded slab from the backbone to the middle. */
function slab(
  ctx: CanvasRenderingContext2D,
  a: Projected,
  b: Projected,
  hex: string,
  near: number,
  alpha: number,
  letter: Base,
  paired: boolean,
) {
  const col = mix(BG, hex, 0.3 + 0.7 * near);
  const w = 2.3 * a.s;
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.strokeStyle = mix(col, "#000000", 0.4);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = w * 0.6;
  ctx.stroke();
  ctx.strokeStyle = mix(col, "#ffffff", 0.45);
  ctx.lineWidth = w * 0.16;
  ctx.beginPath();
  ctx.moveTo(a.x - w * 0.15, a.y - w * 0.15);
  ctx.lineTo(b.x - w * 0.15, b.y - w * 0.15);
  ctx.stroke();
  // letters on the near side, once they are big enough to read
  if (near > 0.55 && a.s > 3.2) {
    const lx = a.x + (b.x - a.x) * 0.38;
    const ly = a.y + (b.y - a.y) * 0.38;
    ctx.font = `800 ${Math.min(13, a.s * 2.1).toFixed(1)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(255,255,255,${(near * (paired ? 0.95 : 0.8)).toFixed(3)})`;
    ctx.fillText(letter, lx, ly + 0.5);
    ctx.textBaseline = "alphabetic";
  }
  ctx.globalAlpha = 1;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export type { Job };
