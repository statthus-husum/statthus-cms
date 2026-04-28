/*
 * Custom UI-Tweaks für Tinas Admin-UI.
 * Wird in app/public/admin/index.html via Dockerfile-Sed eingebunden.
 *
 * Aktuell: blendet das "you have not configured search"-Banner aus.
 * Such-Feature gibt's nur via TinaCloud, wir sind self-hosted —
 * der Hinweis ist permanent ohne Handlungsmöglichkeit.
 */
(function () {
  // 1. CSS-Schicht: greift instant beim Render — kein Flash.
  //    :has() ist seit 2023 in allen modernen Browsern.
  var style = document.createElement("style");
  style.id = "statthus-tweaks-style";
  style.textContent = [
    // 1. "you have not configured search"-Banner ausblenden — Search gibt's
    //    nur via TinaCloud, wir sind self-hosted
    'div:has(> a[href*="tina.io/docs/r/content-search"]),',
    'div:has(> a[href*="tina.io/docs/reference/search"]),',
    'div:has(> a[href*="search/overview"]),',
    'div:has(> a[href*="search/configuration"])',
    "{ display: none !important; }",
    // 2. "Add Folder"-Button verstecken — Hugo kann mit nested Subfolder-
    //    Strukturen schlecht umgehen, plus Editoren erzeugen damit
    //    versehentlich Phantom-Pfade
    'a[href="#/collections/new-folder"],',
    'a[href*="new-folder"]',
    "{ display: none !important; }",
    // 3. Versions-Update-Hinweis verstecken (Warnsymbol + "vX.Y.Z published"-
    //    Zeile unten links). Wir bleiben bewusst auf v2 — der Hinweis dient
    //    nur Verwirrung.
    "span.text-yellow-700,",
    "svg.lucide-triangle-alert:has(+ span.text-yellow-700)",
    "{ display: none !important; }",
  ].join("\n");
  (document.head || document.documentElement).appendChild(style);

  // 2. JS-Schicht: MutationObserver als Fallback für ältere Browser
  //    ohne :has()-Support, plus für Edge-Cases wo der Banner tiefer
  //    verschachtelt rendert.
  var SELECTORS = [
    'a[href*="content-search"]',
    'a[href*="search/overview"]',
    'a[href*="search/configuration"]',
  ].join(", ");

  var pending = false;
  function scan() {
    pending = false;
    document.querySelectorAll(SELECTORS).forEach(function (link) {
      var banner = link.closest("div");
      if (banner && banner.style.display !== "none") {
        banner.style.display = "none";
      }
    });
  }
  function schedule() {
    if (pending) return;
    pending = true;
    (window.requestAnimationFrame || setTimeout)(scan, 16);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }

  var obs = new MutationObserver(schedule);
  obs.observe(document.documentElement, { childList: true, subtree: true });

  // Nach 60 s den Observer wieder abklemmen — der Banner sollte längst
  // gerendert sein, danach würde der Observer nur unnötig CPU verbrauchen.
  setTimeout(function () {
    obs.disconnect();
  }, 60000);
})();
