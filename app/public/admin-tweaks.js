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
    // 2. "Add Folder"-Button selektiv verstecken.
    //    In flachen Collections (event/news/person) machen Unterordner
    //    keinen Sinn — Hugo erwartet dort einzelne MD-Dateien direkt im
    //    Section-Verzeichnis. Editor:innen würden mit Folder-Klick nur
    //    Phantom-Pfade erzeugen.
    //    In projekt/member/help bleibt der Button sichtbar, weil die
    //    Sub-Section-Struktur (z.B. projekt/das-denkmal/...) explizit
    //    gewollt ist.
    //    Den globalen "#/collections/new-folder"-Eintrag (ohne Collection-
    //    Prefix) hide-ich generell — der gehört zu keiner sinnvollen
    //    Aktion.
    'a[href="#/collections/new-folder"],',
    'a[href*="/collections/event"][href*="new-folder"],',
    'a[href*="/collections/news"][href*="new-folder"],',
    'a[href*="/collections/person"][href*="new-folder"]',
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

/*
 * Folder-Create-Hook für den Media-Manager.
 *
 * Tinas Media-Manager hat in der Standalone-Ansicht (über das Menü) einen
 * eigenen "New Folder"-Button. Mit unserer GitHubMediaStore-Implementierung
 * funktioniert Tinas Default-Folder-Logik nicht — also fangen wir den
 * Klick ab und delegieren auf unsere /api/media/mkdir-Route.
 *
 * Im Popup-Picker (beim Foto-Auswählen aus einem Image-Field) gibt es den
 * Button nicht — dort injizieren wir als Fallback einen "+ Ordner"-Button.
 */
(function () {
  var BTN_CLASS = "statthus-mkdir-btn";
  var FOLDER_LABELS = /^(new folder|add folder|create folder|neuer ordner|ordner anlegen|ordner erstellen)$/i;

  async function runMkdirFlow() {
    var name = window.prompt(
      "Neuer Ordner-Name (Unterordner mit / erlaubt, z.B. veranstaltungen/2026):",
    );
    if (!name) return;
    try {
      var res = await fetch("/api/media/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name }),
        credentials: "same-origin",
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        window.alert("Anlegen fehlgeschlagen: " + (data.error || res.status));
        return;
      }
      window.alert(
        "Ordner angelegt: " +
          data.directory +
          (data.alreadyExists ? " (bestand schon)" : "") +
          "\n\nMedia-Manager schließen und neu öffnen, damit er erscheint.",
      );
    } catch (err) {
      window.alert("Fehler: " + (err && err.message));
    }
  }

  // Klick-Interceptor: kapert jeden Klick auf einen Button/Anchor, dessen
  // sichtbarer Text wie "New Folder" / "Neuer Ordner" / etc. aussieht —
  // unabhängig davon, ob Tina ihn selbst gerendert hat oder wir.
  // Capture-Phase, damit wir vor Tinas eigenen Handlern dran sind.
  document.addEventListener(
    "click",
    function (ev) {
      var target = ev.target;
      while (target && target !== document) {
        var tag = target.tagName;
        if (tag === "BUTTON" || tag === "A") {
          var text = (target.textContent || "").trim();
          if (text && FOLDER_LABELS.test(text.toLowerCase())) {
            ev.preventDefault();
            ev.stopPropagation();
            if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
            runMkdirFlow();
            return;
          }
        }
        target = target.parentNode;
      }
    },
    true,
  );

  // Fallback-Injection für den Popup-Picker, wo Tina keinen eigenen
  // Folder-Button rendert. Wir hängen ihn an den "Media Manager"-Heading
  // (oder den Upload-Button, wenn der Heading fehlt).
  function findExistingFolderBtn() {
    var els = document.querySelectorAll("button, a");
    for (var i = 0; i < els.length; i++) {
      var t = (els[i].textContent || "").trim().toLowerCase();
      if (t && FOLDER_LABELS.test(t)) return els[i];
    }
    return null;
  }

  function findAnchor() {
    var headings = document.querySelectorAll("h1, h2, h3, h4, h5");
    for (var i = 0; i < headings.length; i++) {
      var text = (headings[i].textContent || "").trim().toLowerCase();
      if (text && /(media|medien)/.test(text)) {
        return { el: headings[i], strategy: "child" };
      }
    }
    var buttons = document.querySelectorAll("button");
    for (var j = 0; j < buttons.length; j++) {
      var btnText = (buttons[j].textContent || "").trim().toLowerCase();
      if (btnText === "upload" || btnText === "hochladen") {
        return { el: buttons[j], strategy: "sibling" };
      }
    }
    return null;
  }

  function makeBtn() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = BTN_CLASS;
    btn.textContent = "+ Ordner";
    btn.style.cssText = [
      "margin-left:.75rem",
      "padding:.4rem .8rem",
      "background:#0f766e",
      "color:#fff",
      "border:none",
      "border-radius:.25rem",
      "cursor:pointer",
      "font-size:.85rem",
      "font-weight:500",
      "vertical-align:middle",
    ].join(";");
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      runMkdirFlow();
    });
    return btn;
  }

  function tick() {
    if (document.querySelector("." + BTN_CLASS)) return;
    if (findExistingFolderBtn()) return; // Tina hat schon einen — kein Duplikat
    var anchor = findAnchor();
    if (!anchor) return;
    var btn = makeBtn();
    if (anchor.strategy === "sibling" && anchor.el.parentElement) {
      anchor.el.parentElement.insertBefore(btn, anchor.el.nextSibling);
    } else {
      anchor.el.appendChild(btn);
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    (window.requestAnimationFrame || setTimeout)(function () {
      pending = false;
      tick();
    }, 16);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tick);
  } else {
    tick();
  }
  var obs = new MutationObserver(schedule);
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
