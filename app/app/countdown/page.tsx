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

// Vor dem Ziel: verbleibende Zeit (Countdown). Ab dem Ziel: verstrichene
// Zeit seit dem Spatenstich (Count-up). `ms` ist hier immer der Betrag.
function partsFromMs(ms: number): Omit<Parts, "done"> {
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
  };
}

export default function Countdown() {
  const [parts, setParts] = useState<Parts | null>(null);
  // Embed-Hinweis: ?bg=dark → helle Schrift (z.B. im dunklen Website-
  // Footer). Default unverändert: dunkle Schrift für helle/unbekannte
  // Flächen. Die Flip-Karten sind ohnehin dunkel und kontraststark.
  const [onDark, setOnDark] = useState(false);

  useEffect(() => {
    setOnDark(
      new URLSearchParams(window.location.search).get("bg") === "dark",
    );
  }, []);

  // Robustes Embed-Sizing — bewusst NICHT über CSS vw/min-h-screen:
  // in einem iframe lösen die je nach Gerät/Browser gegen den
  // Geräte-Viewport auf (Mobile = „herunterskalierte Desktop-Seite").
  // Stattdessen messen wir die EIGENE Inhaltsbreite des iframes
  // (documentElement.clientWidth, deterministisch = iframe-CSS-Breite)
  // und leiten daraus die Wurzel-Schriftgröße ab; alle rem-Maße der
  // Uhr skalieren dann exakt zur iframe-Box. Die resultierende
  // Inhaltshöhe melden wir per postMessage an die einbettende Seite,
  // die das iframe darauf einstellt (kein geratenes aspect-ratio).
  useEffect(() => {
    const rootEl = document.documentElement;
    function applySize() {
      const w = rootEl.clientWidth || window.innerWidth || 320;
      // ~34 = Gesamtbreite der Uhr in rem; clamp hält es lesbar.
      const fs = Math.min(15, Math.max(5, w / 34));
      rootEl.style.fontSize = fs + "px";
    }
    function postHeight() {
      const h = Math.ceil(document.body.scrollHeight);
      window.parent.postMessage(
        { type: "statthus-countdown-size", height: h },
        "*",
      );
    }
    function sync() {
      applySize();
      postHeight();
    }
    sync();
    // Nach Font-/Layout-Settle nochmal melden.
    const t1 = setTimeout(sync, 300);
    const t2 = setTimeout(sync, 1200);
    const ro = new ResizeObserver(sync);
    ro.observe(rootEl);
    window.addEventListener("resize", sync);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    function tick() {
      const ms = TARGET.getTime() - Date.now();
      const done = ms <= 0;
      // done → ab dem Spatenstich aufwärts zählen (Betrag der Differenz)
      setParts({ ...partsFromMs(Math.abs(ms)), done });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const done = parts?.done === true;
  const cMuted = onDark ? "text-zinc-300" : "text-zinc-500";
  const cStrong = onDark ? "text-white" : "text-zinc-900";
  const cSub = onDark ? "text-zinc-300" : "text-zinc-600";
  const cAccent = onDark ? "text-amber-400" : "text-amber-700";

  return (
    <main className="flex flex-col items-center justify-center overflow-hidden bg-transparent px-4 py-6 text-center">
      <style>{flapCss}</style>

      <p
        className={`mb-5 text-xs uppercase tracking-[0.3em] ${cMuted} sm:mb-8 sm:text-sm`}
      >
        {done ? "Seit dem ersten Spatenstich" : "Bis zum Spatenstich"}
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
        <p className={`text-base font-medium ${cStrong} sm:text-lg`}>
          staTThus Neubau · Husum
        </p>
        {!done && (
          <p className={`mt-1 text-sm ${cSub} sm:text-base`}>
            Spatenstich am 18. Mai 2026 um 14:00 Uhr
          </p>
        )}
        {done && (
          <p
            className={`mt-5 text-sm uppercase tracking-[0.3em] ${cAccent} sm:mt-8`}
          >
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

// Höhe = Karten-Höhe (5rem), damit die zwei Punkte vertikal mittig auf
// der Karten-Trennlinie sitzen. Skaliert wie alles über die fluide
// Wurzel-Schriftgröße; ab Viewport ≥640px sichtbar (im schmalen Footer
// also ausgeblendet — dort steht die Uhr kompakt ohne Trenner).
function Separator() {
  return (
    <div
      aria-hidden
      className="hidden h-[5rem] flex-col items-center justify-center text-zinc-400 sm:flex"
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
/* Seite vollständig transparent (für Overlay/Embed, z.B. iframe oder
   Browser-Source). Überschreibt den Body-Gradient aus globals.css und
   wirkt nur, solange diese Route gemountet ist — andere Next-Seiten
   (z.B. /anleitung) bleiben unverändert. */
html,body{background:transparent !important;}

/* Größe: ALLE Maße sind rem-basiert. Die Wurzel-Schriftgröße setzt
   JS deterministisch aus der EIGENEN iframe-Breite (siehe useEffect
   oben) — NICHT über vw/CSS, das im iframe gerätesabhängig bricht.
   Kein min-h-screen: die Höhe ergibt sich aus dem Inhalt und wird
   per postMessage an die einbettende Seite gemeldet. */

.flap-card{
  position:relative;
  width:3.25rem;
  height:5rem;
  perspective:14.8rem;
  border-radius:.4rem;
  box-shadow:0 10px 24px -10px rgba(0,0,0,0.35),0 2px 6px rgba(0,0,0,0.08);
}

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
