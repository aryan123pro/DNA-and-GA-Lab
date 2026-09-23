"use client";

import { useEffect, useRef } from "react";
import { Base } from "@/lib/dna";
import { BASE_COLOR } from "./ui";

const COMPLEMENT: Record<Base, Base> = { A: "T", T: "A", C: "G", G: "C" };

/**
 * A rotating double helix drawn on a 2-D canvas. Each rung is one base of the
 * strand, paired with its complement — A with T, C with G.
 */
export default function Helix({
  strand,
  damaged,
  height = 260,
  speed = 0.5,
}: {
  strand: string;
  damaged?: Set<number>;
  height?: number | string;
  speed?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const strandRef = useRef(strand);
  const damagedRef = useRef(damaged);

  useEffect(() => {
    strandRef.current = strand;
    damagedRef.current = damaged;
  }, [strand, damaged]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let raf = 0;
    let stopped = false;
    let t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      if (stopped) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const s = strandRef.current || "ACGT";
      const hits = damagedRef.current;
      const cx = w / 2;
      const radius = Math.min(w * 0.22, 86);
      const rungs = Math.min(40, Math.max(10, s.length));
      const gap = h / (rungs + 1);
      const pitch = 0.45;

      // two sugar-phosphate backbones
      for (const phase of [0, Math.PI]) {
        ctx.beginPath();
        for (let i = 0; i <= rungs; i++) {
          const a = i * pitch + t + phase;
          const x = cx + Math.cos(a) * radius;
          const y = gap * (i + 0.5);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = phase === 0 ? "rgba(125,211,252,0.55)" : "rgba(196,181,253,0.55)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      type Node = { x: number; y: number; z: number; color: string; letter: Base; hit: boolean };
      const left: Node[] = [];
      const right: Node[] = [];
      for (let i = 0; i < rungs; i++) {
        const idx = i % s.length;
        const letter = (s[idx] as Base) ?? "A";
        const a = i * pitch + t;
        const y = gap * (i + 0.5);
        const hit = hits?.has(idx) ?? false;
        left.push({
          x: cx + Math.cos(a) * radius,
          y,
          z: Math.sin(a),
          color: BASE_COLOR[letter] ?? "#2563eb",
          letter,
          hit,
        });
        right.push({
          x: cx + Math.cos(a + Math.PI) * radius,
          y,
          z: Math.sin(a + Math.PI),
          color: BASE_COLOR[COMPLEMENT[letter] ?? "T"],
          letter: COMPLEMENT[letter] ?? "T",
          hit,
        });
      }

      // rungs (the base pairs holding the two strands together)
      for (let i = 0; i < rungs; i++) {
        ctx.beginPath();
        ctx.moveTo(left[i].x, left[i].y);
        ctx.lineTo(right[i].x, right[i].y);
        ctx.strokeStyle = left[i].hit ? "rgba(248,113,113,0.85)" : "rgba(139,153,171,0.3)";
        ctx.lineWidth = left[i].hit ? 2 : 1;
        ctx.stroke();
      }

      // bases, painted back to front so the helix reads as 3-D
      const all = [...left, ...right].sort((a, b) => a.z - b.z);
      for (const n of all) {
        const depth = (n.z + 1) / 2;
        const r = 3.4 + depth * 3.4;
        ctx.globalAlpha = 0.35 + depth * 0.65;
        ctx.fillStyle = n.hit ? "#f87171" : n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.hit ? r + 1 : r, 0, Math.PI * 2);
        ctx.fill();
        if (depth > 0.7) {
          ctx.globalAlpha = (depth - 0.7) * 3;
          ctx.fillStyle = "#0b1017";
          ctx.font = "700 8px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(n.letter, n.x, n.y + 0.5);
        }
      }
      ctx.globalAlpha = 1;

      t += speed * 0.014;
      raf = requestAnimationFrame(draw);
    };

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) draw();
    else raf = requestAnimationFrame(draw);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [speed]);

  return <canvas ref={ref} style={{ width: "100%", height, display: "block" }} />;
}
