"use client";

import { useEffect, useState } from "react";

// Spatenstich staTThus Neubau, 18. Mai 2026, 14:00 Uhr Ortszeit Husum
// (CEST = UTC+2). Festes Offset, damit der Countdown nicht durch
// Sommer-/Winterzeit-Eigenheiten der Browser-Uhr verschoben wird.
const TARGET = new Date("2026-05-18T14:00:00+02:00");

type Parts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
};

function partsFromDiff(ms: number): Parts {
  const clamped = Math.max(0, ms);
  return {
    days: Math.floor(clamped / 86_400_000),
    hours: Math.floor((clamped % 86_400_000) / 3_600_000),
    minutes: Math.floor((clamped % 3_600_000) / 60_000),
    seconds: Math.floor((clamped % 60_000) / 1000),
    done: ms <= 0,
  };
}

export default function Countdown() {
  const [parts, setParts] = useState<Parts | null>(null);

  useEffect(() => {
    function tick() {
      setParts(partsFromDiff(TARGET.getTime() - Date.now()));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black px-4 py-12 text-center">
      <p className="mb-6 text-xs uppercase tracking-[0.3em] text-zinc-400 sm:text-sm">
        Bis zum Spatenstich
      </p>

      <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-5">
        <Group label="Tage" value={parts?.days} digits={3} />
        <Separator />
        <Group label="Stunden" value={parts?.hours} digits={2} />
        <Separator />
        <Group label="Minuten" value={parts?.minutes} digits={2} />
        <Separator />
        <Group label="Sekunden" value={parts?.seconds} digits={2} />
      </div>

      <div className="mt-12 max-w-md text-zinc-300">
        <p className="text-base font-medium text-amber-50 sm:text-lg">
          staTThus Neubau · Husum
        </p>
        <p className="mt-1 text-sm text-zinc-400 sm:text-base">
          Spatenstich am 18. Mai 2026 um 14:00 Uhr
        </p>
        {parts?.done && (
          <p className="mt-6 text-sm uppercase tracking-widest text-amber-200">
            Es ist soweit.
          </p>
        )}
      </div>
    </main>
  );
}

function Group({
  label,
  value,
  digits,
}: {
  label: string;
  value: number | undefined;
  digits: number;
}) {
  const str = value === undefined ? "".padStart(digits, "-") : value.toString().padStart(digits, "0");
  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-1.5 sm:gap-2">
        {Array.from(str).map((digit, i) => (
          <Flap key={i} digit={digit} />
        ))}
      </div>
      <div className="mt-3 text-[0.65rem] uppercase tracking-[0.3em] text-zinc-500 sm:text-xs">
        {label}
      </div>
    </div>
  );
}

function Separator() {
  return (
    <div className="hidden h-20 flex-col justify-center text-zinc-700 sm:flex">
      <span className="text-3xl font-bold leading-none">·</span>
      <span className="mt-1 text-3xl font-bold leading-none">·</span>
    </div>
  );
}

// Eine "Klappkarte" wie auf einer Flughafenanzeige: dunkler Hintergrund,
// helle Zeichen, horizontaler Trennstrich in der Mitte, leichter
// Innenschatten oben/unten für den Solari-Effekt.
function Flap({ digit }: { digit: string }) {
  return (
    <div
      className="relative flex h-16 w-12 items-center justify-center overflow-hidden rounded-md bg-zinc-950 font-mono text-3xl font-bold text-amber-50 shadow-[inset_0_2px_8px_rgba(0,0,0,0.6),inset_0_-2px_8px_rgba(255,255,255,0.04),0_4px_12px_rgba(0,0,0,0.5)] ring-1 ring-zinc-800 sm:h-24 sm:w-16 sm:text-5xl md:h-28 md:w-20 md:text-6xl"
      aria-hidden="false"
    >
      <span className="leading-none">{digit}</span>
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-px bg-black/70" />
    </div>
  );
}
