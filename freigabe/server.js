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

const STATUS_LABELS = {
  added: "neu",
  removed: "gelöscht",
  modified: "geändert",
  renamed: "umbenannt",
  copied: "kopiert",
  changed: "verändert",
  unchanged: "unverändert",
};

const commonStyle = () => `<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:56rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#222}
h1{margin-bottom:.5rem}
.status{padding:.75rem 1rem;border-radius:.5rem;background:#eef;margin:1rem 0;border-left:4px solid #69c}
.status.empty{background:#efe;border-left-color:#5a5}
.btn{display:inline-block;padding:.75rem 1.5rem;background:#16a34a;color:#fff;text-decoration:none;border:0;border-radius:.5rem;font-size:1rem;cursor:pointer;font-weight:600}
.btn:hover{background:#15803d}
ul.commit-list{padding-left:1.25rem}
ul.commit-list li{margin-bottom:.5rem}
ul.file-list{list-style:none;padding:0}
ul.file-list>li{margin-bottom:.25rem;border:1px solid #e5e7eb;border-radius:.4rem;background:#fff}
ul.file-list>li>details>summary{padding:.6rem .9rem;cursor:pointer;font-size:.95rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
ul.file-list>li>details>summary:hover{background:#f9fafb}
ul.file-list>li>details[open]>summary{border-bottom:1px solid #e5e7eb;background:#f9fafb}
.tag{font-size:.7rem;padding:.1rem .4rem;border-radius:.3rem;background:#e5e7eb;color:#374151;text-transform:uppercase;letter-spacing:.05em}
.tag.added{background:#d1fadf;color:#054f31}
.tag.removed{background:#fee2e2;color:#7f1d1d}
.tag.modified{background:#dbeafe;color:#1e3a8a}
.tag.renamed{background:#fef3c7;color:#78350f}
.delta{font-size:.75rem;color:#6b7280}
.delta .add{color:#16a34a}
.delta .del{color:#dc2626}
code{background:#f4f4f4;padding:.1rem .3rem;border-radius:.2rem;font-size:.9em}
.diff{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.8rem;background:#f6f8fa;padding:0;margin:0;white-space:pre;overflow-x:auto;line-height:1.45}
.diff>div{padding:0 .9rem}
.diff .add{background:#dcfce7;color:#14532d}
.diff .del{background:#fee2e2;color:#7f1d1d}
.diff .hunk{background:#dbeafe;color:#1e3a8a;font-weight:600}
.diff .meta{color:#6b7280;font-style:italic}
small{color:#666}
.diff-summary{font-size:.85em;color:#666}
</style>`;

function renderPatch(patch) {
  if (!patch) return '<div class="diff"><div class="meta">(Binärdatei oder kein Diff verfügbar)</div></div>';
  const lines = patch.split("\n").map((line) => {
    if (line.startsWith("@@")) return `<div class="hunk">${escape(line)}</div>`;
    if (line.startsWith("+++") || line.startsWith("---")) return `<div class="meta">${escape(line)}</div>`;
    if (line.startsWith("+")) return `<div class="add">${escape(line)}</div>`;
    if (line.startsWith("-")) return `<div class="del">${escape(line)}</div>`;
    return `<div>${escape(line)}</div>`;
  });
  return `<pre class="diff">${lines.join("")}</pre>`;
}

function renderFileItem(f) {
  const status = f.status || "modified";
  const label = STATUS_LABELS[status] || status;
  return `<li>
  <details>
    <summary>
      <span class="tag ${escape(status)}">${escape(label)}</span>
      <code>${escape(f.filename)}</code>
      <span class="delta"><span class="add">+${f.additions || 0}</span> / <span class="del">−${f.deletions || 0}</span></span>
    </summary>
    ${renderPatch(f.patch)}
  </details>
</li>`;
}

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
<ul class="commit-list">
${commits.map((c) => `<li>
  <strong>${escape(c.commit.author.name)}</strong>: ${escape(c.commit.message.split("\n")[0])}
  <br><small>${new Date(c.commit.author.date).toLocaleString("de-DE")}</small>
</li>`).join("")}
</ul>

<h2>Geänderte Dateien <span class="diff-summary">(${files.length})</span></h2>
<p><small>Klick auf eine Datei zeigt den Diff.</small></p>
<ul class="file-list">
${files.map(renderFileItem).join("")}
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
