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
    // 2. "Add Folder"-Button global verstecken. Verschachtelte Strukturen
    //    gab es nur in den (inzwischen aus dem CMS entfernten) Sections
    //    projekt/member/help — in den verbliebenen flachen Collections
    //    (event/news/person) würden Editor:innen damit nur Phantom-Pfade
    //    anlegen. Tinas Default-Folder-Flow committet in unserem
    //    self-hosted Setup ohnehin nichts.
    'a[href="#/collections/new-folder"]',
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

/*
 * Sidebar-Gruppierung: klappbare Köpfe für Collection-Gruppen.
 *
 * TinaCMS hat kein natives Collection-Grouping — jede Collection ist ein
 * flacher Sidebar-Link. Vier THEMEN-Gruppen werden zusammengefasst:
 *   - "News"           : news, news_intro
 *   - "Veranstaltungen": event, event_intro
 *   - "Bewohner:innen" : person, people_intro
 *   - "Weiteres"       : themen_intro (Themen-Kopftexte)
 * Ungruppiert (bewusst, ganz am Ende): user.
 * Voraussetzung: jede Gruppe ist in config.tsx ZUSAMMENHÄNGEND
 * registriert (Sidebar-Reihenfolge = Array-Reihenfolge), sonst umfasst
 * ein Header nicht alle Mitglieder am Stück.
 *
 * Bewusst nicht-invasiv: KEINE React-Knoten reparenten (Tina würde sie
 * beim Re-Render zurücksetzen). Pro Gruppe — analog zum mkdir/rmdir-
 * Button-Pattern oben:
 *   - ein eigener, nicht von React verwalteter Header wird vor die erste
 *     Zeile injiziert (Observer re-injiziert nach Re-Renders)
 *   - Ein-/Ausklappen via row.style.display, per Tick re-appliziert
 *     (setzt nur bei echter Änderung → kein Observer-Endlosloop)
 *   - Zustand je Gruppe in localStorage, Default = eingeklappt
 */
(function () {
  // WICHTIG zum Suffix: TinaCMS rendert die Sidebar-Links als
  // "#/collections/<name>/~" (das "/~" = Root-Folder-Marker; bei offenem
  // Dokument folgt stattdessen "/<datei>"). Die Regex darf den Namen daher
  // NICHT ans String-Ende ankern — sonst matcht nichts und es entstehen
  // keine Gruppen-Header. "(?:[/?].*)?$" erlaubt optionales "/…" oder "?…".
  // Gruppen sind THEMA-basiert (nicht Typ-basiert): die config.tsx-
  // Reihenfolge clustert je Thema, daher matcht jede Regex genau die
  // Collection-Namen eines Themas. themen_intro + user matchen bewusst
  // keine Gruppe → bleiben ungruppiert.
  var GROUPS = [
    {
      key: "statthus.group.news",
      id: "statthus-group-news",
      label: "News",
      re: /^#\/collections\/news(?:_intro)?(?:[/?].*)?$/,
    },
    {
      key: "statthus.group.veranstaltungen",
      id: "statthus-group-veranstaltungen",
      label: "Veranstaltungen",
      re: /^#\/collections\/event(?:_intro)?(?:[/?].*)?$/,
    },
    {
      key: "statthus.group.bewohner",
      id: "statthus-group-bewohner",
      label: "Bewohner:innen",
      re: /^#\/collections\/(?:person|people_intro)(?:[/?].*)?$/,
    },
    {
      key: "statthus.group.weiteres",
      id: "statthus-group-weiteres",
      label: "Weiteres",
      // Aktuell nur themen_intro ("Themen-Kopftexte") — eigene Gruppe,
      // damit die Collection nicht verwaist unten herumsteht.
      re: /^#\/collections\/themen_intro(?:[/?].*)?$/,
    },
  ];
  var CARET_CLASS = "statthus-group-caret";

  function isCollapsed(key) {
    try {
      return localStorage.getItem(key) !== "0"; // Default: collapsed
    } catch (e) {
      return true;
    }
  }
  function setCollapsed(key, v) {
    try {
      localStorage.setItem(key, v ? "1" : "0");
    } catch (e) {
      /* localStorage gesperrt — Zustand nur für diese Session */
    }
  }

  // Collection-Zeilen einer Gruppe in Sidebar-Reihenfolge. Wir hängen an
  // die <li>-Zeile (falls vorhanden), sonst an den <a> selbst.
  function groupRows(re) {
    var rows = [];
    var links = document.querySelectorAll('a[href^="#/collections/"]');
    for (var i = 0; i < links.length; i++) {
      if (!re.test(links[i].getAttribute("href") || "")) continue;
      rows.push(links[i].closest("li") || links[i]);
    }
    return rows;
  }

  function makeHeader(group, sameTag) {
    var el = document.createElement(sameTag === "LI" ? "li" : "div");
    el.id = group.id;
    el.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:.4rem",
      // bündig links (kein linker Innenabstand) — Wunsch: Knoten weiter links
      "padding:.5rem .75rem .5rem 0",
      "margin:0",
      "cursor:pointer",
      "font-weight:600",
      "font-size:.75rem",
      "text-transform:uppercase",
      "letter-spacing:.03em",
      "color:#6b7280",
      "user-select:none",
    ].join(";");
    var caret = document.createElement("span");
    caret.className = CARET_CLASS;
    caret.textContent = "▸";
    caret.style.cssText =
      "display:inline-block;transition:transform .12s;font-size:.7rem";
    var label = document.createElement("span");
    label.textContent = group.label;
    el.appendChild(caret);
    el.appendChild(label);
    el.addEventListener("click", function () {
      setCollapsed(group.key, !isCollapsed(group.key));
      applyGroup(group);
    });
    return el;
  }

  function applyGroup(group) {
    var rows = groupRows(group.re);
    var header = document.getElementById(group.id);
    if (!rows.length) {
      // Nicht auf einer Seite mit Sidebar-Liste — Header entfernen.
      if (header) header.remove();
      return;
    }
    var first = rows[0];
    if (!header) header = makeHeader(group, first.tagName);
    // Header direkt vor die erste Zeile (re)positionieren — nur wenn
    // nötig, sonst löst das eine Observer-Runde aus.
    if (
      header.parentNode !== first.parentNode ||
      header.nextSibling !== first
    ) {
      first.parentNode.insertBefore(header, first);
    }
    var collapsed = isCollapsed(group.key);
    var caret = header.querySelector("." + CARET_CLASS);
    if (caret) {
      caret.style.transform = collapsed ? "" : "rotate(90deg)";
    }
    for (var i = 0; i < rows.length; i++) {
      var want = collapsed ? "none" : "";
      if (rows[i].style.display !== want) rows[i].style.display = want;
    }
  }

  function applyAll() {
    for (var i = 0; i < GROUPS.length; i++) applyGroup(GROUPS[i]);
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    (window.requestAnimationFrame || setTimeout)(function () {
      pending = false;
      applyAll();
    }, 16);
  }

  window.addEventListener("hashchange", schedule);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      applyAll();
      new MutationObserver(schedule).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });
  } else {
    applyAll();
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
})();
