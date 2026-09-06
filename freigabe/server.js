// staTThus Freigabe-App
// Zeigt offene Änderungen auf staging, mergt selektiv per File-Auswahl.
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
const BASE = process.env.BASE_PATH || "/freigabe";
// Workflow-Datei im Website-Repo, die per workflow_dispatch gestartet wird
// (Input `target: ftp` → nur der FTP-Upload, kein Pages-Deploy).
const DEPLOY_WORKFLOW = process.env.DEPLOY_WORKFLOW || "deploy.yml";
// Vorschau-Site (GitHub Pages). Wird bei jedem Push auf main automatisch
// gebaut; die Live-Site (FTP) erst auf Knopfdruck, siehe /deploy-ftp.
const PREVIEW_URL =
  process.env.PREVIEW_URL || "https://statthus-husum.github.io/statthus-website/";

if (!ADMIN_PASS || !GH_TOKEN) {
  console.error("[freigabe] Pflicht-Env fehlt: ADMIN_PASSWORD und/oder GITHUB_PERSONAL_ACCESS_TOKEN");
  process.exit(1);
}

// Pfade, die durch die Freigabe von staging nach main wandern dürfen.
// Genau die Verzeichnisse, die Tina als Collections kennt (Spiegelbild von
// app/docker-entrypoint.sh:TINA_PATHS). Theme-Code, Layouts, Hugo-Config,
// package.json sowie content/-Unterordner, die NICHT in Tina editiert
// werden (z.B. content/german/newsletter, content/german/about, und seit
// dem CMS-Rückbau auch content/german/{projekt,member,help}) bleiben damit
// gegenüber der Freigabe unsichtbar — wenn jemand direkt auf main an
// Theme/Code/Hugo-Pages arbeitet, überschreibt eine Freigabe das nicht.
// Bilder (früher assets/images/uploads/) laufen seit dem Umzug in den
// S3-Media-Bucket gar nicht mehr durch Git — Uploads sind sofort live.
const EDITOR_PREFIXES = [
  "content/users/",
  "content/german/event/",
  "content/german/news/",
  "content/german/people/",
  "content/german/themen/",
];

function isEditorPath(path) {
  return EDITOR_PREFIXES.some((prefix) => path.startsWith(prefix));
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
    err.body = body;
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

// Map: path -> blob-SHA für einen Branch (nur Blobs, nicht Trees).
async function fetchBlobMap(branch) {
  const ref = await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/refs/heads/${branch}`);
  const commit = await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/commits/${ref.object.sha}`);
  const tree = await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/trees/${commit.tree.sha}?recursive=true`);
  const map = new Map();
  for (const entry of tree.tree || []) {
    if (entry.type === "blob") map.set(entry.path, entry.sha);
  }
  return map;
}

// Letzter Commit auf staging, der eine bestimmte Datei berührt hat —
// liefert Autor + Zeitpunkt für die Anzeige in der Datei-Liste.
async function fetchLastCommitForFile(filename) {
  const commits = await gh(
    `/repos/${GH_OWNER}/${GH_REPO}/commits?sha=${STAGING}&path=${encodeURIComponent(filename)}&per_page=1`,
  );
  if (!Array.isArray(commits) || commits.length === 0) return null;
  const c = commits[0];
  return {
    author: c.commit?.author?.name || c.author?.login || "Unbekannt",
    date: c.commit?.author?.date || null,
  };
}

// Holt den title aus YAML-Frontmatter einer Datei auf staging.
// Bei gelöschten oder binären Dateien null.
async function fetchFileTitle(filename, status) {
  if (status === "removed") return null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURI(filename)}?ref=${STAGING}`,
      {
        headers: {
          Authorization: `Bearer ${GH_TOKEN}`,
          Accept: "application/vnd.github.raw",
        },
      },
    );
    if (!res.ok) return null;
    const text = await res.text();
    // Title aus dem Frontmatter rauspflücken (zwischen --- ... ---)
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) return null;
    const titleLine = fm[1].match(/^title:\s*["']?([^"'\n]+?)["']?\s*$/m);
    return titleLine ? titleLine[1].trim() : null;
  } catch {
    return null;
  }
}

// Mappt Pfad → menschlichen Typ-Namen.
function kindLabelForPath(path) {
  if (/^content\/german\/event\//.test(path)) return "Veranstaltung";
  if (/^content\/german\/news\//.test(path)) return "News";
  if (/^content\/german\/people\//.test(path)) return "Bewohner:in";
  if (/^content\/german\/themen\//.test(path)) return "Themen-Intro";
  if (/^content\/users\//.test(path)) return "Editor-Account";
  return null;
}

// Echter Tree-Diff zwischen main und staging — autoritative Quelle für
// "was wartet auf Freigabe". compare.files stimmt nicht in allen Cherry-
// Pick-Szenarien (z.B. file auf main per Cherry-Pick + auf staging
// gelöscht: GitHub's compare zeigt's gar nicht).
async function computePending() {
  const [compare, mainBlobs, stagingBlobs] = await Promise.all([
    gh(`/repos/${GH_OWNER}/${GH_REPO}/compare/${PROD}...${STAGING}`),
    fetchBlobMap(PROD),
    fetchBlobMap(STAGING),
  ]);

  // Patches/Counts aus compare.files, falls verfügbar
  const compareByName = new Map(
    (compare.files || []).map((f) => [f.filename, f]),
  );

  const allPaths = new Set([...mainBlobs.keys(), ...stagingBlobs.keys()]);
  const pending = [];
  for (const path of allPaths) {
    // Theme-/Code-/Config-Änderungen zwischen main und staging gehen
    // niemanden in der Freigabe-UI etwas an — die Freigabe ist
    // ausschließlich für redaktionelle Inhalte da.
    if (!isEditorPath(path)) continue;

    const onMain = mainBlobs.get(path);
    const onStaging = stagingBlobs.get(path);
    if (onMain === onStaging) continue;

    let status;
    if (!onMain) status = "added";
    else if (!onStaging) status = "removed";
    else status = "modified";

    const fromCompare = compareByName.get(path);
    pending.push({
      filename: path,
      status,
      // Bei "removed" wollen wir die alte main-SHA für die Anzeige; das Merge
      // setzt sha:null (siehe /merge-Handler).
      sha: onStaging || onMain,
      additions: fromCompare?.additions ?? 0,
      deletions: fromCompare?.deletions ?? 0,
      patch: fromCompare?.patch || null,
      previous_filename: fromCompare?.previous_filename,
    });
  }
  return pending;
}

// Letzter Lauf des Deploy-Workflows — für die Anzeige im Dashboard.
// Braucht am PAT die Berechtigung "Actions: Read". Fehlt sie, liefern wir
// null und das Dashboard zeigt schlicht keinen Status.
async function fetchLastDeployRun() {
  try {
    const data = await gh(
      `/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${DEPLOY_WORKFLOW}/runs?per_page=1`,
    );
    const run = data?.workflow_runs?.[0];
    if (!run) return null;
    return {
      status: run.status, // queued | in_progress | completed
      conclusion: run.conclusion, // success | failure | cancelled | null
      event: run.event, // push | workflow_dispatch
      url: run.html_url,
      startedAt: run.run_started_at || run.created_at,
    };
  } catch {
    return null;
  }
}

// FTP-Upload der Live-Site anstoßen: workflow_dispatch mit target=ftp auf
// main. GitHub antwortet 204 ohne Body. Braucht am PAT "Actions: Read &
// Write" — sonst 403, und wir sagen im Fehlertext, was fehlt.
app.post("/deploy-ftp", async (req, res) => {
  try {
    await gh(
      `/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${DEPLOY_WORKFLOW}/dispatches`,
      {
        method: "POST",
        body: JSON.stringify({ ref: PROD, inputs: { target: "ftp" } }),
      },
    );
    return res
      .set("Content-Type", "text/html; charset=utf-8")
      .send(noticePage(
        "FTP-Upload gestartet",
        "Die Live-Site wird jetzt neu gebaut und per FTP hochgeladen. Das dauert etwa 2–3 Minuten. Der Stand des Laufs steht in der Übersicht.",
      ));
  } catch (err) {
    const hint =
      err?.status === 403 || err?.status === 404
        ? " — Der GitHub-Token braucht dafür die Berechtigung „Actions: Read & Write“ auf dem Website-Repo."
        : "";
    res
      .status(500)
      .set("Content-Type", "text/html; charset=utf-8")
      .send(errorPage(`FTP-Upload konnte nicht gestartet werden: ${err.message}${hint}`));
  }
});

app.get("/", async (req, res) => {
  try {
    const [pending, lastRun] = await Promise.all([
      computePending(),
      fetchLastDeployRun(),
    ]);

    // Pro Datei: letzten Commit + Titel parallel holen
    const enriched = await Promise.all(
      pending.map(async (f) => {
        const [last, title] = await Promise.all([
          fetchLastCommitForFile(f.filename),
          fetchFileTitle(f.filename, f.status),
        ]);
        return {
          ...f,
          lastCommit: last,
          title,
          kind: kindLabelForPath(f.filename),
        };
      }),
    );

    res
      .set("Content-Type", "text/html; charset=utf-8")
      .send(renderDashboard({ files: enriched, lastRun }));
  } catch (err) {
    res.status(500).send(errorPage(err.message));
  }
});

// Selektive Freigabe: nimmt eine Liste von Datei-Pfaden, baut einen
// neuen Tree auf main + commit + ref-update via Git-Data-API.
app.post("/merge", async (req, res) => {
  try {
    let selected = req.body.files || [];
    if (!Array.isArray(selected)) selected = [selected];
    selected = selected.filter(Boolean);

    if (selected.length === 0) {
      return res
        .status(400)
        .set("Content-Type", "text/html; charset=utf-8")
        .send(noticePage(
          "Keine Dateien ausgewählt",
          'Bitte mindestens eine Datei ankreuzen, dann erneut "Freigeben" klicken.',
        ));
    }

    // Pending-Set über Tree-Diff aufbauen (siehe computePending in GET /).
    const pending = await computePending();
    const filesByPath = new Map(pending.map((f) => [f.filename, f]));

    // Tree-Update vorbereiten
    const treeOps = [];
    const includedPaths = [];
    for (const path of selected) {
      // Defense-in-depth: ein Hand-POST darf keinen Theme-/Code-Pfad
      // durchschmuggeln, selbst wenn er nicht im Pending-Set ist.
      if (!isEditorPath(path)) continue;
      const f = filesByPath.get(path);
      if (!f) continue;
      includedPaths.push(path);

      if (f.status === "removed") {
        // Datei aus main entfernen
        treeOps.push({ path: f.filename, mode: "100644", type: "blob", sha: null });
      } else if (f.status === "renamed") {
        // alte Datei entfernen, neue anlegen
        if (f.previous_filename) {
          treeOps.push({
            path: f.previous_filename,
            mode: "100644",
            type: "blob",
            sha: null,
          });
        }
        treeOps.push({
          path: f.filename,
          mode: "100644",
          type: "blob",
          sha: f.sha,
        });
      } else {
        // added / modified / changed / copied
        treeOps.push({
          path: f.filename,
          mode: "100644",
          type: "blob",
          sha: f.sha,
        });
      }
    }

    if (treeOps.length === 0) {
      return res
        .status(400)
        .send(noticePage(
          "Nichts zu mergen",
          "Die ausgewählten Dateien haben keine Änderungen mehr — vielleicht hat schon jemand anders freigegeben?",
        ));
    }

    // Aktueller main HEAD
    const mainRef = await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/refs/heads/${PROD}`);
    const mainSha = mainRef.object.sha;
    const mainCommit = await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/commits/${mainSha}`);

    // Neuen Tree anlegen, basierend auf main
    const newTree = await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        base_tree: mainCommit.tree.sha,
        tree: treeOps,
      }),
    });

    // Commit anlegen
    const message =
      `Freigabe: ${includedPaths.length} Datei(en) aus ${STAGING}\n\n` +
      includedPaths.map((p) => `- ${p}`).join("\n");

    const newCommit = await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message,
        tree: newTree.sha,
        parents: [mainSha],
      }),
    });

    // main-Ref aktualisieren
    await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/refs/heads/${PROD}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommit.sha }),
    });

    // Staging direkt aufräumen — staging neu auf main basieren, nur die noch
    // ausstehenden Datei-Änderungen oben drauf. So bleibt staging immer als
    // "main + offene Edits" sauber, ohne Commit-Müllhaufen.
    const cleanup = await rebaseStagingOntoMain(newCommit.sha);

    res.set("Content-Type", "text/html; charset=utf-8").send(`<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Freigegeben</title>${commonStyle()}</head>
<body><h1>✅ Freigegeben</h1>
<p><strong>${includedPaths.length}</strong> ${includedPaths.length === 1 ? "Datei wurde" : "Dateien wurden"} veröffentlicht.</p>
<details><summary>Was wurde freigegeben</summary>
<ul>${includedPaths.map((p) => `<li>${escape(p)}</li>`).join("")}</ul>
</details>
<p class="cleanup-note">${escape(cleanup.message)}</p>
<p>Die <a href="${escape(PREVIEW_URL)}" target="_blank" rel="noopener">Vorschau-Site</a> wird in 1–2 Minuten aktualisiert. Wenn dort alles passt: in der Übersicht „Website per FTP hochladen“ klicken — erst dann ändert sich die Live-Site.</p>
<p><a href="/">Zurück zur Übersicht</a></p>
</body></html>`);
  } catch (err) {
    res.status(500).send(errorPage(err.message));
  }
});

// Staging neu auf main basieren. Nur die Datei-Inhalte, die auf staging
// existieren UND noch nicht auf main sind, werden als ein neuer Commit
// oben auf main gesetzt. Force-Update der staging-Ref.
async function rebaseStagingOntoMain(mainSha) {
  const [mainBlobs, stagingBlobs] = await Promise.all([
    fetchBlobMap(PROD),
    fetchBlobMap(STAGING),
  ]);

  // Welche EDITOR-Dateien haben unterschiedliche Blob-SHAs? Theme-/Code-
  // Pfade ignorieren wir — die werden durch die base_tree=main-Basis
  // automatisch von main übernommen, statt durch staging überschrieben
  // zu werden.
  const treeOps = [];
  const allPaths = new Set([...mainBlobs.keys(), ...stagingBlobs.keys()]);
  for (const path of allPaths) {
    if (!isEditorPath(path)) continue;
    const onMain = mainBlobs.get(path);
    const onStaging = stagingBlobs.get(path);
    if (onMain === onStaging) continue;
    treeOps.push({
      path,
      mode: "100644",
      type: "blob",
      sha: onStaging || null, // null = entfernen
    });
  }

  if (treeOps.length === 0) {
    // staging und main sind inhaltlich identisch — staging einfach auf main resetten
    await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/refs/heads/${STAGING}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: mainSha, force: true }),
    });
    return {
      kind: "reset",
      message: `Staging zurückgesetzt — alles freigegeben, nichts mehr offen.`,
    };
  }

  // Neuen Tree auf main + treeOps anlegen
  const mainCommit = await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/commits/${mainSha}`);
  const newTree = await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: mainCommit.tree.sha,
      tree: treeOps,
    }),
  });

  const stagingCommit = await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: `Aufgeräumt: ${treeOps.length} offene Änderung(en) auf main rebased`,
      tree: newTree.sha,
      parents: [mainSha],
    }),
  });

  await gh(`/repos/${GH_OWNER}/${GH_REPO}/git/refs/heads/${STAGING}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: stagingCommit.sha, force: true }),
  });

  return {
    kind: "rebased",
    message: `Staging aufgeräumt — ${treeOps.length} Änderung(en) bleiben offen für die nächste Freigabe.`,
  };
}

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
};

const commonStyle = () => `<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:56rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#222}
.back-link{margin:0 0 .5rem;font-size:.9rem}
.back-link a{color:#6b7280;text-decoration:none}
.back-link a:hover{color:#222;text-decoration:underline}
h1{margin-bottom:.5rem}
.status{padding:.75rem 1rem;border-radius:.5rem;background:#eef;margin:1rem 0;border-left:4px solid #69c}
.status.empty{background:#efe;border-left-color:#5a5}
    .deploy { margin: 1.5rem 0; padding: 1rem 1.25rem; border: 1px solid #ddd; border-radius: 8px; }
    .deploy h2 { margin: 0 0 .5rem; font-size: 1.1rem; }
    .deploy-status { margin: .5rem 0 .75rem; }
.btn{display:inline-block;padding:.75rem 1.5rem;background:#16a34a;color:#fff;text-decoration:none;border:0;border-radius:.5rem;font-size:1rem;cursor:pointer;font-weight:600}
.btn:hover{background:#15803d}
.btn[disabled]{background:#999;cursor:not-allowed}
.toolbar{display:flex;align-items:center;gap:1rem;padding:.5rem .75rem;background:#f3f4f6;border-radius:.4rem;margin:.5rem 0}
.toolbar label{font-size:.9rem;display:flex;align-items:center;gap:.4rem;cursor:pointer}
ul.commit-list{padding-left:1.25rem}
ul.commit-list li{margin-bottom:.5rem}
ul.file-list{list-style:none;padding:0}
ul.file-list>li{margin-bottom:.25rem;border:1px solid #e5e7eb;border-radius:.4rem;background:#fff}
ul.file-list summary{padding:.6rem .9rem;cursor:pointer;font-size:.95rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;list-style:none}
ul.file-list summary::-webkit-details-marker{display:none}
ul.file-list summary::before{content:"▸";color:#6b7280;transition:transform .1s}
ul.file-list details[open] summary::before{transform:rotate(90deg);display:inline-block}
ul.file-list summary:hover{background:#f9fafb}
ul.file-list details[open] summary{border-bottom:1px solid #e5e7eb;background:#f9fafb}
ul.file-list summary input[type=checkbox]{width:1.1rem;height:1.1rem;cursor:pointer}
.tag{font-size:.7rem;padding:.1rem .4rem;border-radius:.3rem;background:#e5e7eb;color:#374151;text-transform:uppercase;letter-spacing:.05em}
.tag.added{background:#d1fadf;color:#054f31}
.tag.removed{background:#fee2e2;color:#7f1d1d}
.tag.modified{background:#dbeafe;color:#1e3a8a}
.tag.renamed{background:#fef3c7;color:#78350f}
.title-and-kind{font-size:.95rem}
.kind{font-size:.75rem;color:#6b7280;background:#f3f4f6;padding:.1rem .4rem;border-radius:.3rem;margin-left:.3rem;font-weight:400;white-space:nowrap}
.meta-line{font-size:.8rem;color:#6b7280;flex-basis:100%;padding-left:2.5rem;margin-top:.1rem}
@media(min-width:42rem){.meta-line{flex-basis:auto;padding-left:.4rem}}
.delta{font-size:.75rem;color:#6b7280;margin-left:auto}
.cleanup-note{padding:.5rem .75rem;background:#f0f9ff;border-left:3px solid #38bdf8;border-radius:.3rem;color:#0c4a6e;font-size:.9rem}
.image-preview{padding:1rem;background:#f9fafb;text-align:center}
.image-preview img{max-width:100%;max-height:60vh;border-radius:.4rem;box-shadow:0 4px 12px rgba(0,0,0,.1)}
.delta .add{color:#16a34a}
.delta .del{color:#dc2626}
code{background:#f4f4f4;padding:.1rem .3rem;border-radius:.2rem;font-size:.9em}
.diff{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.8rem;background:#f6f8fa;padding:0;margin:0;white-space:pre;overflow-x:auto;line-height:1.45}
.diff>div{padding:0 .9rem}
.diff .add{background:#dcfce7;color:#14532d}
.diff .del{background:#fee2e2;color:#7f1d1d}
.diff .hunk{background:#dbeafe;color:#1e3a8a;font-weight:600}
.diff .meta{color:#6b7280;font-style:italic}
.actions{margin-top:1.5rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap}
.count-info{color:#6b7280;font-size:.9rem}
small{color:#666}
.diff-summary{font-size:.85em;color:#666}
</style>`;

function isImagePath(path) {
  return /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(path);
}

function imagePreviewUrl(filename, status) {
  // Bei "removed" zeigen wir die Vorgängerversion auf main, sonst den
  // staging-Stand. raw.githubusercontent.com serviert öffentliche Repos
  // ohne Auth.
  const branch = status === "removed" ? PROD : STAGING;
  return `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${branch}/${filename}`;
}

function renderPreview(f) {
  if (isImagePath(f.filename)) {
    const url = imagePreviewUrl(f.filename, f.status);
    return `<div class="image-preview"><img src="${escape(url)}" alt="${escape(f.filename)}" loading="lazy" /></div>`;
  }
  return renderPatch(f.patch);
}

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
  const id = "f-" + Math.random().toString(36).slice(2, 8);

  // Titel + Typ statt Pfad. Fallback auf Pfad, falls Titel nicht ermittelbar.
  const heading = f.title
    ? `<strong>${escape(f.title)}</strong>${f.kind ? ` <span class="kind">${escape(f.kind)}</span>` : ""}`
    : `<code>${escape(f.filename)}</code>`;

  const meta = f.lastCommit
    ? `${escape(f.lastCommit.author)} · ${escape(formatDate(f.lastCommit.date))}`
    : "";

  return `<li>
  <details>
    <summary>
      <input type="checkbox" name="files" value="${escape(f.filename)}" id="${id}" checked onclick="event.stopPropagation()">
      <span class="tag ${escape(status)}">${escape(label)}</span>
      <span class="title-and-kind">${heading}</span>
      <span class="meta-line">${meta}</span>
      <span class="delta"><span class="add">+${f.additions || 0}</span> / <span class="del">−${f.deletions || 0}</span></span>
    </summary>
    ${renderPreview(f)}
  </details>
</li>`;
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const FILE_LIST_SCRIPT = `<script>
(function () {
  var selectAll = document.getElementById("select-all");
  var btn = document.getElementById("submit-btn");
  var counter = document.getElementById("count-info");

  function getCheckboxes() {
    return Array.from(document.querySelectorAll('input[name="files"]'));
  }

  function update() {
    var boxes = getCheckboxes();
    var checked = boxes.filter(function (b) { return b.checked; });
    if (selectAll) {
      selectAll.checked = checked.length === boxes.length && boxes.length > 0;
      selectAll.indeterminate = checked.length > 0 && checked.length < boxes.length;
    }
    if (btn) btn.disabled = checked.length === 0;
    if (counter) counter.textContent = checked.length + " von " + boxes.length + " ausgewählt";
  }

  if (selectAll) {
    selectAll.addEventListener("change", function () {
      getCheckboxes().forEach(function (b) { b.checked = selectAll.checked; });
      update();
    });
  }

  document.addEventListener("change", function (e) {
    if (e.target && e.target.matches('input[name="files"]')) update();
  });

  update();
})();
</script>`;

function renderDashboard(data) {
  const files = data.files || [];
  const count = files.length;

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>staTThus Freigabe</title>${commonStyle()}</head>
<body>
<p class="back-link"><a href="/">← Übersicht</a></p>
<h1>staTThus · Freigabe</h1>

<div class="status ${count === 0 ? "empty" : ""}">
${count === 0
  ? "✅ Alles aktuell. Keine Änderungen zur Freigabe."
  : `📝 <strong>${count}</strong> ${count === 1 ? "Datei wartet" : "Dateien warten"} auf Freigabe.`}
</div>

${renderDeploySection(data.lastRun)}

${count > 0 ? `
<form method="POST" action="${BASE}/merge" onsubmit="return confirm('Wirklich freigeben? Die ausgewählten Änderungen erscheinen nach 1–2 Min auf der Vorschau-Site. Die Live-Site ändert sich erst nach „Website per FTP hochladen“.')">

<p><small>Häkchen entfernen, um eine Datei <em>nicht</em> freizugeben — sie wartet dann auf den nächsten Durchgang.</small></p>

<div class="toolbar">
  <label><input type="checkbox" id="select-all" checked> Alle auswählen</label>
  <span class="count-info" id="count-info"></span>
</div>

<ul class="file-list">
${files.map(renderFileItem).join("")}
</ul>

<div class="actions">
  <button class="btn" type="submit" id="submit-btn">Ausgewählte Dateien freigeben</button>
</div>

</form>
${FILE_LIST_SCRIPT}
` : ""}

</body></html>`;
}

// Abschnitt „Live-Site hochladen“: Status des letzten Workflow-Laufs plus
// Button, der den FTP-Upload allein anstößt (z.B. nach Änderungen, die
// keinen Push auf main auslösen, oder wenn der Upload hakte).
function renderDeploySection(run) {
  let status = "";
  if (run) {
    const when = new Date(run.startedAt).toLocaleString("de-DE", {
      timeZone: "Europe/Berlin",
      dateStyle: "short",
      timeStyle: "short",
    });
    const via = run.event === "workflow_dispatch" ? "Live-Site (FTP)" : "Vorschau-Site";
    let label;
    if (run.status !== "completed") label = "⏳ läuft gerade";
    else if (run.conclusion === "success") label = "✅ erfolgreich";
    else if (run.conclusion === "cancelled") label = "⛔ abgebrochen";
    else label = "❌ fehlgeschlagen";
    status = `<p class="deploy-status">Letzter Lauf: ${label} · ${escape(when)} · ${via} · <a href="${escape(run.url)}" target="_blank" rel="noopener">Details</a></p>`;
  }
  const running = run && run.status !== "completed";
  return `
<div class="deploy">
  <h2>Live-Site hochladen</h2>
  <p><small>Nach einer Freigabe wird nur die <a href="${escape(PREVIEW_URL)}" target="_blank" rel="noopener">Vorschau-Site</a> neu gebaut. Wenn sie in Ordnung ist, lädt dieser Knopf den aktuellen Stand per FTP auf die Live-Site.</small></p>
  ${status}
  <form method="POST" action="${BASE}/deploy-ftp" onsubmit="return confirm('Aktuellen Stand jetzt auf die Live-Site hochladen?')">
    <button class="btn" type="submit" ${running ? "disabled" : ""}>Website per FTP hochladen</button>
  </form>
</div>`;
}

function noticePage(title, body) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>${escape(title)}</title>${commonStyle()}</head>
<body><h1>${escape(title)}</h1><p>${escape(body)}</p><p><a href="${BASE}/">Zurück</a></p></body></html>`;
}

function errorPage(msg) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Fehler</title>${commonStyle()}</head>
<body><h1>⚠️ Fehler</h1><pre>${escape(msg)}</pre><p><a href="${BASE}/">Zurück</a></p></body></html>`;
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[freigabe] listening on :${PORT}, base=${BASE}, repo=${GH_OWNER}/${GH_REPO}, ${STAGING}->${PROD}`);
});
