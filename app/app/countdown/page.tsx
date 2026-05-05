"use client";

import { useEffect, useState } from "react";

// Spatenstich staTThus Neubau, 18. Mai 2026, 14:00 Uhr Husum (CEST = UTC+2).
// Festes Offset, damit der Countdown nicht durch Sommer-/Winterzeit-
// Eigenheiten der Browser-Uhr verschoben wird.
const TARGET = new Date("2026-05-18T14:00:00+02:00");
const FLIP_MS = 600;

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

  const done = parts?.done === true;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-6 text-center sm:py-12">
      <style>{flapCss}</style>

      <p className="mb-5 text-xs uppercase tracking-[0.3em] text-zinc-500 sm:mb-8 sm:text-sm">
        {done ? "Heute ist es soweit" : "Bis zum Spatenstich"}
      </p>

      <div className="flex flex-wrap items-start justify-center gap-3 sm:gap-5">
        <Group label="Tage" value={parts?.days} digits={3} />
        <Separator />
        <Group label="Stunden" value={parts?.hours} digits={2} />
        <Separator />
        <Group label="Minuten" value={parts?.minutes} digits={2} />
        <Separator />
        <Group label="Sekunden" value={parts?.seconds} digits={2} />
      </div>

      <div className="mt-6 max-w-md sm:mt-12">
        <p className="text-base font-medium text-zinc-900 sm:text-lg">
          staTThus Neubau · Husum
        </p>
        <p className="mt-1 text-sm text-zinc-600 sm:text-base">
          Spatenstich am 18. Mai 2026 um 14:00 Uhr
        </p>
        {done && (
          <p className="mt-5 text-sm uppercase tracking-[0.3em] text-amber-700 sm:mt-8">
            Wir bauen.
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
  const str =
    value === undefined
      ? "-".repeat(digits)
      : value.toString().padStart(digits, "0");
  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-1.5 sm:gap-2">
        {Array.from(str).map((digit, i) => (
          <Flap key={i} digit={digit} />
        ))}
      </div>
      <div className="mt-3 text-[0.65rem] uppercase tracking-[0.3em] text-zinc-600 sm:text-xs">
        {label}
      </div>
    </div>
  );
}

// Höhe matcht die Karten-Höhe pro Breakpoint, damit die zwei Punkte
// vertikal mittig auf der Karten-Trennlinie sitzen — nicht zwischen
// Karten und Labels.
function Separator() {
  return (
    <div
      aria-hidden
      className="hidden h-[5rem] flex-col items-center justify-center text-zinc-400 sm:flex sm:h-[7rem] md:h-[8.5rem]"
    >
      <span className="block text-3xl font-bold leading-none">·</span>
      <span className="mt-1.5 block text-3xl font-bold leading-none">·</span>
    </div>
  );
}

// Flughafen-Klappkarte mit echter Flip-Animation.
//
// Layout: zwei statische Hälften zeigen den aktuellen Zustand (oben =
// neue Ziffer, unten = alte Ziffer bis Animation fertig). Bei einem
// Wechsel laufen zwei animierte Overlays:
//   • Oben: alte Ziffer dreht sich nach vorn weg (rotateX 0 → -90°)
//   • Unten: neue Ziffer schnappt von oben hoch (rotateX 90° → 0°)
// Nach FLIP_MS wird `prev` auf die neue Ziffer gesetzt und die Overlays
// verschwinden — der bestehende statische untere Teil zeigt dann selbst
// die neue Ziffer, ohne sichtbaren Sprung.
function Flap({ digit }: { digit: string }) {
  const [prev, setPrev] = useState(digit);

  useEffect(() => {
    if (digit !== prev) {
      const id = setTimeout(() => setPrev(digit), FLIP_MS);
      return () => clearTimeout(id);
    }
  }, [digit, prev]);

  const animating = digit !== prev;
  // key sorgt dafür, dass beim direkten Folge-Wechsel (z.B. wenn der
  // Browser-Tab kurz inaktiv war und mehrere Sekunden auf einmal
  // einlaufen) die CSS-Animation jeweils neu startet.
  const animKey = `${prev}-${digit}`;

  return (
    <div className="flap-card">
      <div className="flap-half flap-top">
        <span className="flap-glyph">{digit}</span>
      </div>
      <div className="flap-half flap-bottom">
        <span className="flap-glyph">{prev}</span>
      </div>
      {animating && (
        <>
          <div key={`t-${animKey}`} className="flap-half flap-top flap-flip-down">
            <span className="flap-glyph">{prev}</span>
          </div>
          <div key={`b-${animKey}`} className="flap-half flap-bottom flap-flip-up">
            <span className="flap-glyph">{digit}</span>
          </div>
        </>
      )}
    </div>
  );
}

// CSS für die Klappkarten. Inline gehalten, damit die Komponente in sich
// abgeschlossen bleibt und nicht in globals.css streut.
const flapCss = `
.flap-card{
  position:relative;
  width:3.25rem;
  height:5rem;
  perspective:240px;
  border-radius:.4rem;
  box-shadow:0 10px 24px -10px rgba(0,0,0,0.35),0 2px 6px rgba(0,0,0,0.08);
}
@media(min-width:640px){.flap-card{width:4.5rem;height:7rem;perspective:300px}}
@media(min-width:768px){.flap-card{width:5.5rem;height:8.5rem;perspective:360px}}

.flap-half{
  position:absolute;
  left:0;right:0;
  height:50%;
  overflow:hidden;
  background:#0a0a0a;
  display:flex;
  justify-content:center;
  color:#fef3c7;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-weight:700;
  box-shadow:inset 0 0 0 1px #1f1f1f;
}
.flap-top{
  top:0;
  align-items:flex-start;
  border-bottom:1px solid #000;
  border-radius:.35rem .35rem 0 0;
}
.flap-bottom{
  bottom:0;
  align-items:flex-end;
  border-radius:0 0 .35rem .35rem;
}

/* Glyph-Höhe = Karten-Höhe, sodass jede Hälfte exakt die Hälfte der
   Ziffer zeigt. Schrift dabei optisch leicht zurücknehmen, damit der
   Trennspalt nicht durch die Mitte der "8" oder "0" geht. */
.flap-glyph{
  display:block;
  font-size:5rem;
  line-height:1;
}
@media(min-width:640px){.flap-glyph{font-size:7rem}}
@media(min-width:768px){.flap-glyph{font-size:8.5rem}}

.flap-flip-down{
  z-index:2;
  transform-origin:bottom;
  animation:flap-down ${FLIP_MS / 2}ms ease-in forwards;
  background:#0a0a0a;
}
.flap-flip-up{
  z-index:2;
  transform-origin:top;
  transform:rotateX(90deg);
  animation:flap-up ${FLIP_MS / 2}ms ease-out ${FLIP_MS / 2}ms forwards;
  background:#0a0a0a;
}
@keyframes flap-down{
  from{transform:rotateX(0)}
  to{transform:rotateX(-90deg)}
}
@keyframes flap-up{
  from{transform:rotateX(90deg)}
  to{transform:rotateX(0)}
}

@media(prefers-reduced-motion:reduce){
  .flap-flip-down,.flap-flip-up{animation:none;display:none}
}
`;
