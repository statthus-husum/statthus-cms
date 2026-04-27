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
    ];
  },
};
