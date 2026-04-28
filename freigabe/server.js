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

app.get("/", async (req, res) => {
  try {
    // 1. Compare API (für Commits + Patches + Status-Hinweise)
    // 2. Tree-basierte Echt-Diff-Prüfung (filtert Cherry-Pick-Geister raus)
    const [compare, mainBlobs, stagingBlobs] = await Promise.all([
      gh(`/repos/${GH_OWNER}/${GH_REPO}/compare/${PROD}...${STAGING}`),
      fetchBlobMap(PROD),
      fetchBlobMap(STAGING),
    ]);

    // Aus compare.files nur die behalten, deren Blob-SHA auf main !== staging
    const trulyPending = (compare.files || []).filter((f) => {
      const onMain = mainBlobs.get(f.filename);
      const onStaging = stagingBlobs.get(f.filename);
      return onMain !== onStaging;
    });

    res
      .set("Content-Type", "text/html; charset=utf-8")
      .send(renderDashboard({ ...compare, files: trulyPending }));
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

    const compare = await gh(
      `/repos/${GH_OWNER}/${GH_REPO}/compare/${PROD}...${STAGING}`,
    );
    const filesByPath = new Map(
      (compare.files || []).map((f) => [f.filename, f]),
    );

    // Tree-Update vorbereiten
    const treeOps = [];
    const includedPaths = [];
    for (const path of selected) {
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

    res.set("Content-Type", "text/html; charset=utf-8").send(`<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Freigegeben</title>${commonStyle()}</head>
<body><h1>✅ Freigegeben</h1>
<p><strong>${includedPaths.length}</strong> Datei(en) auf <code>${escape(PROD)}</code> übertragen.</p>
<p>Commit: <code>${escape(newCommit.sha.substring(0, 8))}</code></p>
<details><summary>Was wurde freigegeben</summary>
<ul>${includedPaths.map((p) => `<li><code>${escape(p)}</code></li>`).join("")}</ul>
</details>
<p>Die Site wird in 1–2 Minuten aktualisiert.</p>
<p><a href="${BASE}/">Zurück zur Übersicht</a></p>
</body></html>`);
  } catch (err) {
    res.status(500).send(errorPage(err.message));
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
};

const commonStyle = () => `<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:56rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#222}
h1{margin-bottom:.5rem}
.status{padding:.75rem 1rem;border-radius:.5rem;background:#eef;margin:1rem 0;border-left:4px solid #69c}
.status.empty{background:#efe;border-left-color:#5a5}
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
.delta{font-size:.75rem;color:#6b7280;margin-left:auto}
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
  return `<li>
  <details>
    <summary>
      <input type="checkbox" name="files" value="${escape(f.filename)}" id="${id}" checked onclick="event.stopPropagation()">
      <span class="tag ${escape(status)}">${escape(label)}</span>
      <code>${escape(f.filename)}</code>
      <span class="delta"><span class="add">+${f.additions || 0}</span> / <span class="del">−${f.deletions || 0}</span></span>
    </summary>
    ${renderPatch(f.patch)}
  </details>
</li>`;
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
  : `📝 <strong>${ahead}</strong> Commit(s), <strong>${files.length}</strong> Datei(en) warten auf Freigabe.`}
</div>

${ahead > 0 ? `
<h2>Commits</h2>
<ul class="commit-list">
${commits.map((c) => `<li>
  <strong>${escape(c.commit.author.name)}</strong>: ${escape(c.commit.message.split("\n")[0])}
  <br><small>${new Date(c.commit.author.date).toLocaleString("de-DE")}</small>
</li>`).join("")}
</ul>

<form method="POST" action="${BASE}/merge" onsubmit="return confirm('Wirklich freigeben? Die ausgewählten Änderungen erscheinen nach 1–2 Min auf der Live-Site.')">

<h2>Geänderte Dateien</h2>
<p><small>Standardmäßig sind alle ausgewählt. Häkchen entfernen, um eine Datei <em>nicht</em> freizugeben — sie bleibt auf <code>${escape(STAGING)}</code> liegen, bis du sie später freigibst oder verwirfst.</small></p>

<div class="toolbar">
  <label><input type="checkbox" id="select-all" checked> Alle auswählen</label>
  <span class="count-info" id="count-info"></span>
</div>

<ul class="file-list">
${files.map(renderFileItem).join("")}
</ul>

<div class="actions">
  <button class="btn" type="submit" id="submit-btn">Ausgewählte Dateien freigeben</button>
  <a href="https://github.com/${escape(GH_OWNER)}/${escape(GH_REPO)}/compare/${escape(PROD)}...${escape(STAGING)}" target="_blank" rel="noopener" style="margin-left:auto;font-size:.85rem">Diff in GitHub anzeigen ↗</a>
</div>

</form>
${FILE_LIST_SCRIPT}
` : ""}

</body></html>`;
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
