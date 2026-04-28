// staTThus Freigabe-App
// Zeigt offene Änderungen auf staging, mergt staging->main per Klick.
// Auth: HTTP Basic. Container hinter Caddy (Pfad /freigabe/).

import express from "express";
import basicAuth from "express-basic-auth";

const PORT = Number(process.env.PORT) || 3001;
const ADMIN_USER = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD;
const GH_TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const GH_OWNER = process.env.GITHUB_OWNER || "statthus-husum";
const GH_REPO = process.env.GITHUB_REPO || "statthus-website";
const STAGING = process.env.STAGING_BRANCH || "staging";
const PROD = process.env.PROD_BRANCH || "main";
// Externer URL-Pfad (Caddy proxyt /freigabe/* nach hier ohne Prefix —
// nur für Links im HTML brauchen wir den Pfad).
const BASE = process.env.BASE_PATH || "/freigabe";

if (!ADMIN_PASS || !GH_TOKEN) {
  console.error("[freigabe] Pflicht-Env fehlt: ADMIN_PASSWORD und/oder GITHUB_PERSONAL_ACCESS_TOKEN");
  process.exit(1);
}

const gh = async (path, opts = {}) => {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const body = await res.json();
  if (!res.ok) {
    const msg = body?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return body;
};

const app = express();
app.set("trust proxy", true);
app.use(express.urlencoded({ extended: false }));

app.use(
  basicAuth({
    users: { [ADMIN_USER]: ADMIN_PASS },
    challenge: true,
    realm: "staTThus Freigabe",
  }),
);

app.get("/healthz", (req, res) => res.send("ok"));

app.get("/", async (req, res) => {
  try {
    const compare = await gh(
      `/repos/${GH_OWNER}/${GH_REPO}/compare/${PROD}...${STAGING}`,
    );
    res
      .set("Content-Type", "text/html; charset=utf-8")
      .send(renderDashboard(compare));
  } catch (err) {
    res.status(500).send(errorPage(err.message));
  }
});

app.post("/merge", async (req, res) => {
  try {
    const result = await gh(`/repos/${GH_OWNER}/${GH_REPO}/merges`, {
      method: "POST",
      body: JSON.stringify({
        base: PROD,
        head: STAGING,
        commit_message: `Freigabe via staTThus-CMS-Approval (${new Date().toISOString()})`,
      }),
    });
    res.set("Content-Type", "text/html; charset=utf-8").send(`<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Freigegeben</title>${commonStyle()}</head>
<body><h1>✅ Freigegeben</h1>
<p>${result?.sha
        ? `Merge-Commit: <code>${result.sha.substring(0, 8)}</code>`
        : "Bereits aktuell — nichts zu tun."}</p>
<p>Die Site wird in 1–2 Minuten aktualisiert.</p>
<p><a href="${BASE}/">Zurück zur Übersicht</a></p>
</body></html>`);
  } catch (err) {
    if (err.status === 204 || err.status === 409) {
      res.send(`Nichts zu mergen oder Konflikt (${err.message}). <a href="${BASE}/">Zurück</a>`);
    } else {
      res.status(500).send(errorPage(err.message));
    }
  }
});

const escape = (s) =>
  String(s).replace(
    /[<>&"']/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c],
  );

const commonStyle = () => `<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#222}
h1{margin-bottom:.5rem}
.status{padding:.75rem 1rem;border-radius:.5rem;background:#eef;margin:1rem 0;border-left:4px solid #69c}
.status.empty{background:#efe;border-left-color:#5a5}
.btn{display:inline-block;padding:.75rem 1.5rem;background:#16a34a;color:#fff;text-decoration:none;border:0;border-radius:.5rem;font-size:1rem;cursor:pointer;font-weight:600}
.btn:hover{background:#15803d}
ul{padding-left:1.25rem}
li{margin-bottom:.5rem}
code{background:#f4f4f4;padding:.1rem .3rem;border-radius:.2rem;font-size:.9em}
small{color:#666}
.diff-summary{font-size:.85em;color:#666}
</style>`;

function renderDashboard(compare) {
  const commits = compare?.commits || [];
  const files = compare?.files || [];
  const ahead = compare?.ahead_by ?? commits.length;

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>staTThus Freigabe</title>${commonStyle()}</head>
<body>
<h1>staTThus · Freigabe</h1>
<p><small>Vergleicht <code>${escape(STAGING)}</code> mit <code>${escape(PROD)}</code> in <code>${escape(GH_OWNER)}/${escape(GH_REPO)}</code></small></p>

<div class="status ${ahead === 0 ? "empty" : ""}">
${ahead === 0
  ? "✅ Alles aktuell. Keine Änderungen zur Freigabe."
  : `📝 <strong>${ahead}</strong> Commit(s) warten auf Freigabe.`}
</div>

${ahead > 0 ? `
<h2>Commits</h2>
<ul>
${commits.map((c) => `<li>
  <strong>${escape(c.commit.author.name)}</strong>: ${escape(c.commit.message.split("\n")[0])}
  <br><small>${new Date(c.commit.author.date).toLocaleString("de-DE")}</small>
</li>`).join("")}
</ul>

<h2>Geänderte Dateien <span class="diff-summary">(${files.length})</span></h2>
<ul>
${files.map((f) => `<li>
  <code>${escape(f.filename)}</code>
  <span class="diff-summary">— ${escape(f.status)}, +${f.additions}/-${f.deletions}</span>
</li>`).join("")}
</ul>

<form method="POST" action="${BASE}/merge" onsubmit="return confirm('Wirklich freigeben? Die Änderungen erscheinen nach 1–2 Min auf der Live-Site.')">
  <button class="btn" type="submit">Alle Änderungen freigeben &amp; veröffentlichen</button>
</form>
<p><small>Im Zweifel zuerst den
<a href="https://github.com/${escape(GH_OWNER)}/${escape(GH_REPO)}/compare/${escape(PROD)}...${escape(STAGING)}" target="_blank" rel="noopener">vollständigen Diff in GitHub</a> anschauen.</small></p>
` : ""}

</body></html>`;
}

function errorPage(msg) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Fehler</title>${commonStyle()}</head>
<body><h1>⚠️ Fehler</h1><pre>${escape(msg)}</pre><p><a href="${BASE}/">Zurück</a></p></body></html>`;
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[freigabe] listening on :${PORT}, base=${BASE}, repo=${GH_OWNER}/${GH_REPO}, ${STAGING}->${PROD}`);
});
