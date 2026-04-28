// Branch- + Repo-Werte für die /images-Rewrite. Müssen bei der Build-Zeit
// bekannt sein, weil rewrites() einmalig zur Server-Initialisierung
// ausgewertet wird.
const GITHUB_OWNER = process.env.GITHUB_OWNER || "statthus-husum";
const GITHUB_REPO = process.env.GITHUB_REPO || "statthus-website";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "staging";

module.exports = {
  // standalone-Output bewusst NICHT verwendet: wir brauchen das volle
  // node_modules zur Laufzeit, damit `tinacms build` für die initiale
  // MongoDB-Indexierung im Container ausgeführt werden kann.
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },

  async rewrites() {
    return [
      {
        source: "/admin",
        destination: "/admin/index.html",
      },
      // Hugo-Convention: /images/* wird in der Live-Site aus static/images/
      // geliefert. Im Tina-Admin (auf schreibe.statthus-husum.de) gibt's
      // diese Dateien nicht — daher proxien wir direkt von GitHub-Raw,
      // damit Bild-Previews und Markdown-`<img>`-Tags im Editor laufen.
      {
        source: "/images/:path*",
        destination: `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/static/images/:path*`,
      },
    ];
  },
};
