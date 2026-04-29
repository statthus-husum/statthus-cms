// Legt einen Unterordner unter assets/images/uploads/ an, indem ein
// .gitkeep-Marker committet wird. GitHub kann keine leeren Ordner
// speichern — über Marker-Dateien tun wir trotzdem so. Tina ruft das
// indirekt über den admin-tweaks "+ Ordner"-Button auf.

import type { NextApiRequest, NextApiResponse } from "next";

const OWNER = process.env.GITHUB_OWNER || "statthus-husum";
const REPO = process.env.GITHUB_REPO || "statthus-website";
const BRANCH = process.env.GITHUB_BRANCH || "staging";
const TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN!;
const MEDIA_DIR = "assets/images/uploads";

function isAuthed(req: NextApiRequest) {
  const cookies = req.cookies || {};
  return Boolean(
    cookies["next-auth.session-token"] ||
      cookies["__Secure-next-auth.session-token"],
  );
}

// Slug-light (gleiche Regeln wie upload.ts safeName, ohne Punkte).
function safeSegment(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .replace(/^_+|_+$/g, "");
}

// Validiert den Eingabepfad und normalisiert ihn auf einen vollen
// Repo-Pfad innerhalb von MEDIA_DIR.
function resolveTarget(rawPath: string, rawParent: string): string | null {
  const parent = (rawParent || "").trim().replace(/^\/+|\/+$/g, "");
  // parent muss leer oder MEDIA_DIR / ein Unterordner davon sein
  let base = MEDIA_DIR;
  if (parent) {
    if (parent.includes("..")) return null;
    if (parent !== MEDIA_DIR && !parent.startsWith(MEDIA_DIR + "/")) return null;
    base = parent;
  }

  // Pfad kann mehrere Segmente enthalten (a/b/c) — alle einzeln slugifizieren.
  const segments = rawPath
    .split("/")
    .map((s) => safeSegment(s))
    .filter(Boolean);
  if (segments.length === 0) return null;
  return `${base}/${segments.join("/")}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();
  if (!isAuthed(req)) return res.status(401).json({ error: "Not authenticated" });
  if (!TOKEN) return res.status(500).json({ error: "GitHub token not set" });

  try {
    const body = (req.body || {}) as { name?: string; parent?: string };
    const target = resolveTarget(body.name || "", body.parent || "");
    if (!target) {
      return res.status(400).json({ error: "invalid folder name" });
    }

    const keepPath = `${target}/.gitkeep`;

    // Falls die Datei (oder der Ordner) schon existiert: idempotent OK.
    const existsRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURI(keepPath)}?ref=${BRANCH}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
    if (existsRes.ok) {
      return res.json({ ok: true, directory: target, alreadyExists: true });
    }

    const ghRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURI(keepPath)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          message: `Media: Ordner ${target} angelegt`,
          content: "",
          branch: BRANCH,
        }),
      },
    );

    if (!ghRes.ok) {
      const errBody = await ghRes.json().catch(() => ({}));
      return res
        .status(502)
        .json({ error: errBody.message || "GitHub mkdir failed" });
    }

    return res.json({ ok: true, directory: target });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
