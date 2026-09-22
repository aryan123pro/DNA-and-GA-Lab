"use client";

import Landing from "@/components/Landing";
import Shell from "@/components/Shell";
import { useApp } from "@/lib/store";

export default function Home() {
  const started = useApp((s) => s.started);
  return started ? <Shell /> : <Landing />;
}
