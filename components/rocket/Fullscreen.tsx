"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button, cx } from "@/components/ui";

const ACCENT = "#ea580c";

/**
 * The stage is promoted to fullscreen by id rather than through a React ref:
 * the element has to already be in the document when requestFullscreen is
 * called, and looking it up by id keeps the hook free of refs, which React's
 * compiler will not allow us to read during render anyway.
 */
const STAGE_ID = "rocket-stage";

/* -------------------------------------------------------------------------- */

export interface Stage {
  open: boolean;
  enter: () => void;
  exit: () => void;
}

/**
 * Real browser fullscreen — chrome, tabs and all gone.
 *
 * The stage element itself is promoted, not the document, so nothing of the
 * page can show around the edges even if the document happens to be wider than
 * the screen. It stays mounted at zero size while closed so that the request
 * can fire straight from the click handler, which is the only place browsers
 * reliably allow it.
 */
export function useStage(): Stage {
  const [open, setOpen] = useState(false);

  const enter = useCallback(() => {
    // if the browser refuses, the fixed overlay still fills the window
    document
      .getElementById(STAGE_ID)
      ?.requestFullscreen?.()
      .catch(() => {});
    setOpen(true);
  }, []);

  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setOpen(false);
  }, []);

  // Esc and F11 leave fullscreen without telling us, so follow the document
  useEffect(() => {
    const sync = () => {
      if (!document.fullscreenElement) setOpen(false);
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // when the browser refused real fullscreen, Esc still has to get you out
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);

  return { open, enter, exit };
}

/** The button that opens a lab out to the whole screen. */
export function ExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" accent={ACCENT} onClick={onClick} title="Full screen">
      <Maximize2 size={13} /> Full screen
    </Button>
  );
}

/** One instrument module in the console. */
export function Hud({
  children,
  className,
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border border-line bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        pad && "px-3.5 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function HudTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2.5">
      <h4 className="mono text-[10.5px] font-bold tracking-[0.16em] text-ink-2 uppercase">
        {children}
      </h4>
      {hint && <p className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{hint}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export interface ConsoleTab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

export interface ConsoleStat {
  label: string;
  value: ReactNode;
  /** colour of the value */
  tone?: string;
}

const DOCK = 384;

/**
 * Mission control. A header strip across the top, the scene in the middle,
 * and a docked instrument panel down the right: live readouts pinned at the
 * top, everything else on tabs, so nothing ever has to be scrolled to.
 */
export default function FullscreenStage({
  stage,
  title,
  subtitle,
  status = "live",
  stats,
  scene,
  pinned,
  tabs,
  bar,
}: {
  stage: Stage;
  title: string;
  subtitle?: string;
  /** the light in the corner of the header */
  status?: "live" | "idle" | "good" | "bad";
  /** big readouts in the header */
  stats?: ConsoleStat[];
  /** stretched to fill the scene area; should accept height 100% */
  scene: ReactNode;
  /** always visible at the top of the dock */
  pinned?: ReactNode;
  /** the rest of the instruments, one tab at a time */
  tabs?: ConsoleTab[];
  /** the transport strip floating along the bottom of the scene */
  bar?: ReactNode;
}) {
  const [showDock, setShowDock] = useState(true);
  const [tabId, setTabId] = useState<string | null>(null);
  const hasDock = Boolean(pinned || (tabs && tabs.length));
  const dock = hasDock && showDock;
  const active = tabs?.find((t) => t.id === tabId) ?? tabs?.[0];

  // no page scrolling behind the stage, and no stray horizontal scrollbar
  // making the window wider than the screen
  useEffect(() => {
    if (!stage.open) return;
    const body = document.body.style;
    const prev = { overflow: body.overflow };
    body.overflow = "hidden";
    return () => {
      body.overflow = prev.overflow;
    };
  }, [stage.open]);

  const light = {
    live: "#fb923c",
    idle: "#64748b",
    good: "#4ade80",
    bad: "#f87171",
  }[status];

  // Portalled to <body>: an animated ancestor with a transform would otherwise
  // become the containing block for `position: fixed`, and when the browser
  // declines real fullscreen the overlay would land in the middle of the page.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      id={STAGE_ID}
      className={
        stage.open
          ? "console fixed inset-0 z-50 overflow-hidden bg-paper text-ink"
          : "pointer-events-none fixed top-0 left-0 h-0 w-0 overflow-hidden opacity-0"
      }
      style={stage.open ? { width: "100vw", height: "100vh" } : undefined}
      aria-hidden={!stage.open}
    >
      {!stage.open ? null : (
        <>
          {/* ---- header strip ------------------------------------------------ */}
          <header className="absolute inset-x-0 top-0 z-20 flex h-14 items-center gap-4 border-b border-line bg-sunken/95 px-4 backdrop-blur">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {status === "live" && (
                  <span
                    className="absolute inset-0 animate-ping rounded-full opacity-60"
                    style={{ background: light }}
                  />
                )}
                <span
                  className="relative h-2.5 w-2.5 rounded-full"
                  style={{ background: light, boxShadow: `0 0 10px ${light}` }}
                />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[14px] leading-tight font-semibold text-ink">
                  {title}
                </div>
                {subtitle && (
                  <div className="mono truncate text-[10.5px] text-ink-3">{subtitle}</div>
                )}
              </div>
            </div>

            {stats && stats.length > 0 && (
              <div className="ml-2 hidden items-stretch gap-px overflow-hidden rounded-lg border border-line bg-line lg:flex">
                {stats.map((s) => (
                  <div key={s.label} className="bg-surface px-3 py-1">
                    <div className="mono text-[8.5px] tracking-[0.16em] text-ink-3 uppercase">
                      {s.label}
                    </div>
                    <div
                      className="mono text-[14px] leading-tight font-bold tabular-nums"
                      style={{ color: s.tone ?? "var(--color-ink)" }}
                    >
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="ml-auto flex shrink-0 items-center gap-2">
              {hasDock && (
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => setShowDock((v) => !v)}
                  title={showDock ? "Hide the instrument panel" : "Show the instrument panel"}
                >
                  {showDock ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
                  {showDock ? "Hide panel" : "Show panel"}
                </Button>
              )}
              <Button
                size="sm"
                variant="quiet"
                onClick={stage.exit}
                title="Leave full screen (Esc)"
              >
                <Minimize2 size={13} /> Exit
                <kbd className="mono rounded border border-line px-1 text-[9.5px] text-ink-3">
                  esc
                </kbd>
              </Button>
            </div>
          </header>

          {/* ---- the scene, sized to the space the dock leaves ------------ */}
          <div
            className="absolute top-14 bottom-0 left-0"
            style={{ right: dock ? `min(${DOCK}px, 88vw)` : 0 }}
          >
            <div className="absolute inset-0">{scene}</div>
            {bar && (
              <div className="absolute right-3 bottom-3 left-3 z-10">
                <div className="rounded-xl border border-line bg-sunken/85 px-3.5 py-2.5 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.8)] backdrop-blur-md">
                  {bar}
                </div>
              </div>
            )}
          </div>

          {/* ---- the instrument dock -------------------------------------- */}
          {dock && (
            <aside
              className="absolute top-14 right-0 bottom-0 z-10 flex flex-col border-l border-line bg-sunken"
              style={{ width: `min(${DOCK}px, 88vw)` }}
            >
              {pinned && <div className="shrink-0 border-b border-line p-3">{pinned}</div>}

              {tabs && tabs.length > 0 && (
                <>
                  <nav
                    className="flex shrink-0 gap-1 border-b border-line px-3 pt-2"
                    role="tablist"
                  >
                    {tabs.map((t) => {
                      const on = t.id === active?.id;
                      return (
                        <button
                          key={t.id}
                          role="tab"
                          aria-selected={on}
                          onClick={() => setTabId(t.id)}
                          className={cx(
                            "mono -mb-px flex cursor-pointer items-center gap-1.5 rounded-t-lg border border-b-0 px-2.5 py-1.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase transition-colors",
                            on
                              ? "border-line bg-surface text-ink"
                              : "border-transparent text-ink-3 hover:text-ink-2",
                          )}
                          style={on ? { boxShadow: `inset 0 2px 0 ${ACCENT}` } : undefined}
                        >
                          {t.icon}
                          {t.label}
                        </button>
                      );
                    })}
                  </nav>
                  <div className="min-h-0 flex-1 overflow-y-auto bg-surface/40 p-3" role="tabpanel">
                    {active?.content}
                  </div>
                </>
              )}
            </aside>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}
