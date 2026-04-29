// Löscht ein Bild aus assets/images/ vom konfigurierten Branch.

import type { NextApiRequest, NextApiResponse } from "next";

const OWNER = process.env.GITHUB_OWNER || "statthus-husum";
const REPO = process.env.GITHUB_REPO || "statthus-website";
const BRANCH = process.env.GITHUB_BRANCH || "staging";
const TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN!;
const MEDIA_DIR = "assets/images";

function isAuthed(req: NextApiRequest) {
  const cookies = req.cookies || {};
  return Boolean(
    cookies["next-auth.session-token"] ||
      cookies["__Secure-next-auth.session-token"],
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "DELETE") return res.status(405).end();
  if (!isAuthed(req)) return res.status(401).json({ error: "Not authenticated" });
  if (!TOKEN) return res.status(500).json({ error: "GitHub token not set" });

  const path = String(req.query.path || "");
  if (!path.startsWith(MEDIA_DIR + "/") || path.includes("..")) {
    return res.status(400).json({ error: "invalid path" });
  }

  try {
    const existsRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}?ref=${BRANCH}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
    if (!existsRes.ok) return res.status(404).json({ error: "not found" });
    const existing = await existsRes.json();

    const ghRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          message: `Media-Delete via Tina: ${existing.name}`,
          sha: existing.sha,
          branch: BRANCH,
        }),
      },
    );
    if (!ghRes.ok) {
      const errBody = await ghRes.json();
      return res
        .status(502)
        .json({ error: errBody.message || "GitHub delete failed" });
    }
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
