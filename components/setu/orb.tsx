"use client";

import { forwardRef } from "react";
import { Loader2, Mic, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

/**
 * The orb is the whole interface: one thing to look at, one thing to tap.
 * Its scale is written straight onto the `--amp` custom property from an
 * AnalyserNode, so it moves with the actual voice rather than on a timer.
 */
const PALETTE: Record<OrbState, { a: string; b: string; halo: string; ring: string }> = {
  idle: {
    a: "oklch(0.62 0.15 262)",
    b: "oklch(0.72 0.11 240)",
    halo: "oklch(0.62 0.15 262)",
    ring: "text-primary/30",
  },
  listening: {
    a: "oklch(0.68 0.15 175)",
    b: "oklch(0.74 0.14 205)",
    halo: "oklch(0.66 0.16 180)",
    ring: "text-success/40",
  },
  thinking: {
    a: "oklch(0.76 0.14 78)",
    b: "oklch(0.70 0.13 45)",
    halo: "oklch(0.74 0.14 70)",
    ring: "text-warning/30",
  },
  speaking: {
    a: "oklch(0.60 0.17 285)",
    b: "oklch(0.68 0.15 250)",
    halo: "oklch(0.62 0.17 275)",
    ring: "text-primary/35",
  },
};

export const Orb = forwardRef<HTMLDivElement, { state: OrbState; size?: number }>(
  function Orb({ state, size = 208 }, ref) {
    const c = PALETTE[state];

    return (
      <div
        ref={ref}
        className="setu-orb"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {/* Ripples only while it is actually taking your voice in. */}
        {state === "listening" && (
          <div className={cn("absolute inset-0", c.ring)}>
            <span className="setu-orb-ring" />
            <span className="setu-orb-ring" />
            <span className="setu-orb-ring" />
          </div>
        )}

        <div
          className="setu-orb-halo"
          style={{ background: `radial-gradient(circle, ${c.halo} 0%, transparent 68%)` }}
        />

        <div className="setu-orb-scale">
        <div
          className="setu-orb-body relative overflow-hidden rounded-full"
          style={{ width: size, height: size }}
        >
          <div
            className="setu-orb-blob setu-orb-blob-a"
            style={{ background: `radial-gradient(circle at 32% 30%, ${c.a} 0%, transparent 62%)` }}
          />
          <div
            className="setu-orb-blob setu-orb-blob-b"
            style={{ background: `radial-gradient(circle at 68% 70%, ${c.b} 0%, transparent 60%)` }}
          />

          {/* A slow bright sweep reads as "working on it". */}
          {state === "thinking" && (
            <div
              className="setu-orb-sweep"
              style={{
                background: `conic-gradient(from 0deg, transparent 0deg, ${c.a} 70deg, transparent 150deg)`,
                opacity: 0.55,
                filter: "blur(14px)",
              }}
            />
          )}

          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/25 to-transparent" />
          <div className="absolute inset-0 grid place-items-center text-white">
            {state === "thinking" ? (
              <Loader2 className="size-8 animate-spin drop-shadow" />
            ) : state === "speaking" ? (
              <Volume2 className="size-9 drop-shadow" />
            ) : (
              <Mic className="size-9 drop-shadow" />
            )}
          </div>
        </div>
        </div>
      </div>
    );
  },
);
