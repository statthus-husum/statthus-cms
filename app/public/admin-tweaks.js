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
    // 2. "Add Folder"-Button: kein statischer CSS-Hide. Tina rendert den
    //    Button mit dem Href "#/collections/new-folder" — also ohne
    //    Collection-Prefix, sodass eine reine CSS-Regel ihn nur global
    //    zeigen oder verstecken könnte. Visibility wird kontextabhängig
    //    in der JS-Schicht (siehe weiter unten) geregelt: Button nur in
    //    projekt/member/help sichtbar, sonst versteckt.
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
 * Content-Folder-Steuerung
 *   1. "Add Folder"-Button nur in den Collections sichtbar machen, in denen
 *      verschachtelte Strukturen vom Hugo-Theme tatsächlich vorgesehen
 *      sind (projekt/member/help). In flachen Collections (event/news/
 *      person) bleibt er versteckt, sonst würden Editor:innen Phantom-
 *      Pfade anlegen.
 *   2. Klick auf den Button abfangen: Tinas Default-Folder-Flow committet
 *      in unserem self-hosted Setup nichts — also fragen wir per
 *      window.prompt nach dem Namen, slugifizieren ihn und committen ein
 *      _index.md über /api/content/mkdir.
 *   3. Live-Slugify in Modals als Fallback (z.B. wenn Tina doch mal
 *      einen Folder-Modal mit Hash "new-folder" zeigt).
 */
(function () {
  var FOLDER_BTN_SELECTOR = 'a[href="#/collections/new-folder"]';
  var FOLDER_ALLOWED_COLLECTIONS = ["projekt", "member", "help"];

  function currentCollection() {
    // Hash-Format: "#/collections/<name>" oder "#/collections/<name>/<file>"
    var match = (window.location.hash || "").match(
      /^#\/collections\/([^/?]+)/,
    );
    return match ? match[1] : null;
  }

  function updateFolderBtnVisibility() {
    var btn = document.querySelector(FOLDER_BTN_SELECTOR);
    if (!btn) return;
    var col = currentCollection();
    var allow = col && FOLDER_ALLOWED_COLLECTIONS.indexOf(col) !== -1;
    btn.style.display = allow ? "" : "none";
  }

  function slugify(value) {
    return (value || "")
      .toString()
      .toLowerCase()
      .replace(/[äÄ]/g, "ae")
      .replace(/[öÖ]/g, "oe")
      .replace(/[üÜ]/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // React trackt Input-Werte intern; ein direktes input.value = ... wird
  // sonst nicht als Änderung erkannt. Über den Property-Setter und ein
  // dispatched "input"-Event geht das durch.
  function setReactValue(input, value) {
    var setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Klick auf den Add-Folder-Anchor abfangen, eigene Mkdir-Route ansteuern.
  async function runContentMkdirFlow(collection) {
    var raw = window.prompt(
      "Name des neuen Abschnitts (z.B. 'Das Denkmal'):",
    );
    if (raw === null) return;
    raw = raw.trim();
    if (!raw) return;

    try {
      var res = await fetch("/api/content/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection: collection, title: raw }),
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
          (data.path || "(unbekannt)") +
          (data.alreadyExists
            ? " (bestand schon)"
            : "\n\nIm Ordner liegt eine Platzhalter-Datei 'neuer-eintrag.md', " +
              "die du umbenennen oder füllen kannst.") +
          "\n\nDamit der Eintrag erscheint:" +
          "\n  1. Über /freigabe veröffentlichen" +
          "\n  2. Tina-UI neu laden",
      );
    } catch (err) {
      window.alert("Fehler: " + (err && err.message));
    }
  }

  // Tinas Add-Folder-Link öffnet sein Modal bereits im onMouseDown
  // (siehe tinacms-Source: setFolderModalOpen(true) im Mousedown-Handler).
  // Ein reiner Click-Interceptor wäre zu spät: Tinas Modal stünde dann
  // schon offen, und wenn Editor:innen dort "Create" drücken, geht der
  // Folder-Create über die interne GraphQL-Mutation, die in unserem
  // self-hosted MongoDB+GitHub-Setup nichts committet.
  // Lösung: in der Capture-Phase auf document beide Events kapern und per
  // stopImmediatePropagation Tinas React-Handler ausbremsen — das Modal
  // bleibt zu, der Prompt kommt sauber einmal auf click.
  function handleFolderBtnInteraction(ev) {
    var target = ev.target;
    if (!target) return;
    var anchor = target.closest
      ? target.closest(FOLDER_BTN_SELECTOR)
      : null;
    if (!anchor) return;
    var col = currentCollection();
    if (!col || FOLDER_ALLOWED_COLLECTIONS.indexOf(col) === -1) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    if (ev.type === "click") {
      runContentMkdirFlow(col);
    }
  }
  document.addEventListener("mousedown", handleFolderBtnInteraction, true);
  document.addEventListener("click", handleFolderBtnInteraction, true);

  var slugifying = false;
  document.addEventListener("input", function (ev) {
    if (slugifying) return;
    if (!/new-folder/.test(window.location.hash || "")) return;
    var input = ev.target;
    if (
      !input ||
      input.tagName !== "INPUT" ||
      (input.type && input.type !== "text")
    )
      return;

    var slug = slugify(input.value);
    if (slug === input.value) return;

    var caretEnd = slug.length;
    slugifying = true;
    setReactValue(input, slug);
    try {
      input.setSelectionRange(caretEnd, caretEnd);
    } catch (e) {
      // bei type="text" sollte das gehen — manche Tina-Inputs werfen aber,
      // einfach ignorieren
    }
    slugifying = false;
  });

  // Sichtbarkeit anpassen, sobald sich Hash ändert oder DOM neu rendert.
  window.addEventListener("hashchange", updateFolderBtnVisibility);

  var domObs = new MutationObserver(function () {
    updateFolderBtnVisibility();
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      updateFolderBtnVisibility();
      domObs.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });
  } else {
    updateFolderBtnVisibility();
    domObs.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
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
 * Sub-Section-Ordner löschen.
 *
 * Pendant zum Folder-Create-Hook oben: wenn Editor:innen in einem
 * individuell angelegten Sub-Folder unter projekt/member/help stehen
 * (URL-Hash `#/collections/{projekt|member|help}/~/<slug>`), injizieren
 * wir einen "Ordner löschen"-Button neben Tinas Add-File/Add-Folder.
 * Klick → window.confirm → POST /api/content/rmdir, der via Tinas
 * deleteDocument-Mutation alle Dateien im Ordner einzeln entfernt
 * (MongoDB-Index UND GitHub).
 *
 * Sichtbarkeit:
 *   - Nur in Folder-View (URL enthält "/~/<slug>"), nicht in Collection-Roots
 *   - Nur für die drei Sub-Section-Collections projekt/member/help
 *   ⇒ die Top-Level-Collections selbst und z.B. event/news/people sind
 *     dadurch nicht löschbar.
 */
(function () {
  var BTN_ID = "statthus-rmdir-btn";
  var FOLDER_HASH_RE =
    /^#\/collections\/(projekt|member|help)\/~\/([^?]+?)\/?(?:\?.*)?$/;

  function currentSubFolder() {
    var hash = window.location.hash || "";
    var m = hash.match(FOLDER_HASH_RE);
    if (!m) return null;
    var slug = (m[2] || "").trim();
    if (!slug) return null;
    return { collection: m[1], slug: slug };
  }

  async function runRmdirFlow(collection, slug) {
    var folderPath = "content/german/" + collection + "/" + slug;
    var confirmed = window.confirm(
      "Ordner und alle darin liegenden Dateien löschen?\n\n" +
        folderPath +
        "\n\nDas kann nicht rückgängig gemacht werden.",
    );
    if (!confirmed) return;
    try {
      var res = await fetch("/api/content/rmdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection: collection, slug: slug }),
        credentials: "same-origin",
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        window.alert(
          "Löschen fehlgeschlagen: " + (data.error || res.status),
        );
        return;
      }
      window.alert(
        "Ordner gelöscht: " +
          (data.path || folderPath) +
          " (" +
          (data.deleted || 0) +
          " Datei(en))" +
          "\n\nDamit der Eintrag verschwindet:" +
          "\n  1. Über /freigabe veröffentlichen" +
          "\n  2. Tina-UI neu laden",
      );
      // Zurück auf Collection-Root, sonst zeigt Tina einen toten Folder-View.
      window.location.hash = "#/collections/" + collection;
    } catch (err) {
      window.alert("Fehler: " + (err && err.message));
    }
  }

  function findActionContainer() {
    // Tina rendert "Add File" als <Link> mit href "#/collections/new/<col>...".
    // Dessen Parent-<div> ist der Buttons-Container; daneben hängt
    // "Add Folder". Da fügen wir den Delete-Button ein.
    var addFile = document.querySelector('a[href^="#/collections/new/"]');
    return addFile && addFile.parentElement ? addFile.parentElement : null;
  }

  function makeBtn(collection, slug) {
    var btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.textContent = "Ordner löschen";
    btn.style.cssText = [
      "margin-left:.5rem",
      "padding:0 1.5rem",
      "height:2.5rem",
      "background:#dc2626",
      "color:#fff",
      "border:none",
      "border-radius:.25rem",
      "cursor:pointer",
      "font-size:.875rem",
      "font-weight:500",
      "vertical-align:middle",
      "white-space:nowrap",
    ].join(";");
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      runRmdirFlow(collection, slug);
    });
    return btn;
  }

  function tick() {
    var existing = document.getElementById(BTN_ID);
    var ctx = currentSubFolder();
    if (!ctx) {
      // Wir sind nicht in einem löschbaren Folder — Button raus, falls da.
      if (existing) existing.remove();
      return;
    }
    // Wenn Button schon da ist und auf den richtigen Folder zeigt: nichts tun.
    if (existing && existing.dataset.slug === ctx.collection + "/" + ctx.slug) {
      return;
    }
    if (existing) existing.remove();
    var container = findActionContainer();
    if (!container) return; // Tina hat die Action-Bar noch nicht gerendert
    var btn = makeBtn(ctx.collection, ctx.slug);
    btn.dataset.slug = ctx.collection + "/" + ctx.slug;
    container.appendChild(btn);
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

  window.addEventListener("hashchange", tick);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      tick();
      var obs = new MutationObserver(schedule);
      obs.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });
  } else {
    tick();
    var obs = new MutationObserver(schedule);
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
})();
