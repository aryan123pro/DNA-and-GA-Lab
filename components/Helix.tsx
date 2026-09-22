"use client";

import { useEffect, useRef } from "react";
import { Base } from "@/lib/codec";
import { BASE_COLOR } from "./ui";

const COMPLEMENT: Record<Base, Base> = { A: "T", T: "A", C: "G", G: "C" };

export default function Helix({
  strand,
  damaged,
  height = 340,
  speed = 0.45,
  rungs = 64,
  className,
}: {
  strand: string;
  damaged?: Set<number>;
  height?: number | string;
  speed?: number;
  rungs?: number;
  className?: string;
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
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    let stop = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    type Node = {
      x: number;
      y: number;
      z: number;
      color: string;
      letter: Base;
      hit: boolean;
      partnerX: number;
      partnerZ: number;
      partnerColor: string;
    };

    const draw = () => {
      if (stop) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const s = strandRef.current || "ACGT";
      const dmg = damagedRef.current;

      const cx = w / 2;
      const R = Math.min(w * 0.26, 110);
      const n = Math.min(rungs, Math.max(12, s.length));
      const gap = h / (n + 1);
      const pitch = 0.42;

      const nodes: Node[] = [];
      for (let i = 0; i < n; i++) {
        const idx = i % s.length;
        const letter = (s[idx] as Base) ?? "A";
        const a = i * pitch + t;
        const z = Math.sin(a);
        const pz = Math.sin(a + Math.PI);
        nodes.push({
          x: cx + Math.cos(a) * R,
          y: gap * (i + 1),
          z,
          color: BASE_COLOR[letter] ?? "#38bdf8",
          letter,
          hit: dmg?.has(idx) ?? false,
          partnerX: cx + Math.cos(a + Math.PI) * R,
          partnerZ: pz,
          partnerColor: BASE_COLOR[COMPLEMENT[letter] ?? "T"],
        });
      }

      // backbone ribbons
      for (const side of [0, Math.PI]) {
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const a = i * pitch + t + side;
          const x = cx + Math.cos(a) * R;
          const y = gap * (i + 1);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, side === 0 ? "rgba(45,212,167,0.85)" : "rgba(124,108,255,0.85)");
        grad.addColorStop(1, side === 0 ? "rgba(34,184,255,0.25)" : "rgba(255,95,210,0.3)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.4;
        ctx.shadowBlur = 14;
        ctx.shadowColor = side === 0 ? "rgba(45,212,167,0.6)" : "rgba(124,108,255,0.6)";
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // rungs + bases, painted back-to-front
      const order = nodes.map((_, i) => i).sort((a, b) => nodes[a].z - nodes[b].z);
      for (const i of order) {
        const nd = nodes[i];
        const depth = (nd.z + 1) / 2; // 0 back, 1 front
        const alpha = 0.22 + depth * 0.78;

        ctx.globalAlpha = 0.18 + depth * 0.4;
        ctx.strokeStyle = nd.hit ? "#ff5d73" : "#5b7099";
        ctx.lineWidth = nd.hit ? 2.4 : 1.1;
        ctx.beginPath();
        ctx.moveTo(nd.x, nd.y);
        ctx.lineTo(nd.partnerX, nd.y);
        ctx.stroke();

        const r1 = 3 + depth * 4.2;
        const pd = (nd.partnerZ + 1) / 2;
        const r2 = 3 + pd * 4.2;

        ctx.globalAlpha = 0.2 + pd * 0.8;
        ctx.fillStyle = nd.partnerColor;
        ctx.beginPath();
        ctx.arc(nd.partnerX, nd.y, r2, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = alpha;
        ctx.fillStyle = nd.hit ? "#ff5d73" : nd.color;
        ctx.shadowBlur = nd.hit ? 18 : 10;
        ctx.shadowColor = nd.hit ? "#ff5d73" : nd.color;
        ctx.beginPath();
        ctx.arc(nd.x, nd.y, nd.hit ? r1 + 1.6 : r1, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (depth > 0.62 && r1 > 5.2) {
          ctx.globalAlpha = (depth - 0.62) * 2.4;
          ctx.fillStyle = "#04060c";
          ctx.font = "700 8px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(nd.letter, nd.x, nd.y + 0.5);
        }
      }
      ctx.globalAlpha = 1;

      t += speed * 0.016;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [speed, rungs]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width: "100%", height, display: "block" }}
    />
  );
}
