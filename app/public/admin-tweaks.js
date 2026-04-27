/*
 * Custom UI-Tweaks für Tinas Admin-UI.
 * Wird in app/public/admin/index.html via Dockerfile-Sed eingebunden.
 *
 * Aktuell: blendet das "you have not configured search"-Banner aus.
 * Such-Feature gibt's nur via TinaCloud, wir sind self-hosted —
 * der Hinweis ist permanent ohne Handlungsmöglichkeit.
 */
(function () {
  function hideSearchBanner() {
    var found = false;
    document
      .querySelectorAll('a[href*="search/overview"], a[href*="search/configuration"]')
      .forEach(function (link) {
        var banner = link.closest("div, section, aside, p");
        // Nach oben laufen, bis wir einen Container mit Geschwistern finden —
        // das ist typischerweise der eigentliche Banner-Wrapper.
        while (
          banner &&
          banner.parentElement &&
          banner.parentElement.children.length === 1
        ) {
          banner = banner.parentElement;
        }
        if (banner) {
          banner.style.display = "none";
          found = true;
        }
      });
    return found;
  }

  // Initial-Versuch + Polling, bis das React-Bundle den Banner gerendert hat
  // (max 15 s, dann aufgeben — sonst leeres Polling für immer).
  var attempts = 0;
  var iv = setInterval(function () {
    attempts++;
    if (hideSearchBanner() || attempts > 30) {
      clearInterval(iv);
    }
  }, 500);
})();
