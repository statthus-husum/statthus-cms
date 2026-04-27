/*
 * Custom UI-Tweaks für Tinas Admin-UI.
 * Wird in app/public/admin/index.html via Dockerfile-Sed eingebunden.
 *
 * Aktuell: blendet das "you have not configured search"-Banner aus.
 * Such-Feature gibt's nur via TinaCloud, wir sind self-hosted —
 * der Hinweis ist permanent ohne Handlungsmöglichkeit.
 */
(function () {
  // Tina nutzt verschiedene URL-Pfade für die Search-Doku, je nach Version.
  // Wir matchen auf alle bekannten Varianten.
  var SEARCH_LINK_SELECTORS = [
    'a[href*="content-search"]',
    'a[href*="search/overview"]',
    'a[href*="search/configuration"]',
  ].join(", ");

  function hideSearchBanner() {
    var found = false;
    document.querySelectorAll(SEARCH_LINK_SELECTORS).forEach(function (link) {
      // Direkter umschließender div ist hier der Banner.
      var banner = link.closest("div");
      if (banner) {
        banner.style.display = "none";
        found = true;
      }
    });
    return found;
  }

  // Initial-Versuch + Polling, bis das React-Bundle den Banner gerendert hat
  // (max 30 s, dann aufgeben).
  var attempts = 0;
  var iv = setInterval(function () {
    attempts++;
    if (hideSearchBanner() || attempts > 60) {
      clearInterval(iv);
    }
  }, 500);
})();
