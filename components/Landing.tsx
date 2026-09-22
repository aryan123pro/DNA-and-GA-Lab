"use client";

import { motion } from "framer-motion";
import { ArrowRight, Dna, Recycle, ShieldCheck, Sparkles } from "lucide-react";
import { useApp } from "@/lib/store";
import Helix from "./Helix";
import { Badge } from "./ui";

export default function Landing() {
  const { message, setMessage, start } = useApp();

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
        <div className="mx-auto h-full w-full max-w-4xl">
          <Helix
            strand="ACGTTGCAGCTAACGTGGCATTACGCATGACGTTGCA"
            height="100%"
            speed={0.35}
            rungs={80}
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 90, damping: 18 }}
        className="glass relative z-10 w-full max-w-2xl rounded-3xl p-6 sm:p-8"
        style={{
          borderColor: "#2dd4a744",
          background:
            "linear-gradient(160deg, rgba(10,16,30,0.97), rgba(5,8,16,0.98))",
        }}
      >
        <div className="flex flex-col items-center text-center">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            className="pulse-ring flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "linear-gradient(140deg,#2dd4a7,#22b8ff)" }}
          >
            <Dna size={26} className="text-black" />
          </motion.div>

          <div className="mono mt-4 text-[10px] font-bold tracking-[0.3em] text-teal uppercase">
            Nature-inspired storage &amp; computing
          </div>
          <h1 className="mt-1.5 text-3xl leading-none font-bold tracking-tight text-white sm:text-[40px]">
            DNA CODEC LAB
          </h1>
          <p className="mono mt-2 text-[12px] text-slate-300 italic">
            “What if evolution designed the file format?”
          </p>

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Badge tone="#2dd4a7">v3.0</Badge>
            <Badge tone="#7c6cff">
              <Recycle size={10} /> Closed-loop GA → storage
            </Badge>
            <Badge tone="#22b8ff">
              <ShieldCheck size={10} /> Simulation model
            </Badge>
          </div>

          <p className="mt-4 max-w-xl text-[12px] leading-relaxed text-slate-400">
            Most DNA-storage demos evolve a sequence. This one evolves the{" "}
            <span className="text-teal">codec itself</span>. A genetic algorithm breeds a
            population of complete storage schemes — codon tables, whitening keys, homopolymer
            caps and error-correcting layers — and the fittest chromosome becomes the live
            encoder that compiles your message into nucleotides.
          </p>

          <div className="mt-5 w-full text-left">
            <div className="mono mb-2 text-[10px] tracking-[0.2em] text-slate-500 uppercase">
              Payload to archive
            </div>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && start()}
              className="mono w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-base tracking-wide text-teal outline-none transition focus:border-teal/60"
              placeholder="Type your message…"
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={start}
            className="mono mt-3 flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl px-6 py-3.5 text-[13px] font-bold tracking-[0.18em] text-black uppercase"
            style={{
              background: "linear-gradient(120deg,#2dd4a7,#22b8ff)",
              boxShadow: "0 18px 50px -20px #2dd4a7",
            }}
          >
            <Sparkles size={16} /> Boot the lab <ArrowRight size={16} />
          </motion.button>

          <div className="mono mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-[10px] text-slate-600">
            <span>No biological DNA synthesised</span>
            <span>·</span>
            <span>100% client-side</span>
            <span>·</span>
            <span>Every number computed live</span>
          </div>
        </div>
      </motion.div>

    </div>
  );
}
