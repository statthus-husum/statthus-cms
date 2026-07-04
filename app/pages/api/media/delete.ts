// Löscht ein Bild aus dem S3-Media-Bucket — inklusive Thumbnail und
// Manifest-Eintrag des Ordners.

import type { NextApiRequest, NextApiResponse } from "next";

import {
  MEDIA_ROOT,
  hasS3Credentials,
  deleteObject,
  removeManifestEntry,
  thumbKey,
} from "../../../lib/media-s3";

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
  if (!hasS3Credentials()) return res.status(500).json({ error: "S3 credentials not set" });

  const key = String(req.query.path || "");
  if (!key.startsWith(MEDIA_ROOT + "/") || key.includes("..")) {
    return res.status(400).json({ error: "invalid path" });
  }

  try {
    await deleteObject(key);
    // Thumb kann fehlen (svg/gif) — DeleteObject ist idempotent, S3
    // antwortet auch für nicht existierende Keys mit 204.
    await deleteObject(thumbKey(key));

    const dir = key.slice(0, key.lastIndexOf("/"));
    const file = key.slice(key.lastIndexOf("/") + 1);
    await removeManifestEntry(dir, file);

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
