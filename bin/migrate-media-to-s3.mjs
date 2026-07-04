#!/usr/bin/env node
// Einmalige Migration: Bilder aus dem Website-Repo (assets/images/uploads/)
// in den Hetzner-S3-Media-Bucket kopieren — mit derselben Optimierung wie
// der Tina-Upload-Endpunkt (max. 2500px, PNG level 9 / JPEG q82 mozjpeg),
// plus Thumbnail (_thumbs/<name>.webp, max. 800px) und manifest.json pro
// Ordner (siehe app/lib/media-s3.ts für das Key-Layout).
//
// Läuft lokal gegen einen Website-Checkout; nutzt sharp + @aws-sdk aus
// app/node_modules (vorher dort `npm install --legacy-peer-deps`).
//
// Aufruf:
//   S3_ACCESS_KEY=... S3_SECRET_KEY=... \
//   node bin/migrate-media-to-s3.mjs [--dry-run] [--only Galerie] \
//     /pfad/zum/statthus-website
//
// Optionale Env (Defaults wie docker-compose.yml):
//   S3_ENDPOINT (fsn1.your-objectstorage.com), S3_REGION (fsn1),
//   MEDIA_S3_BUCKET (statthus-media)
//
// Idempotent: erneuter Lauf überschreibt dieselben Keys.

import { createRequire } from "node:module";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const require = createRequire(
  new URL("../app/node_modules/", import.meta.url),
);
const sharp = require("sharp");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const ENDPOINT = process.env.S3_ENDPOINT || "fsn1.your-objectstorage.com";
const REGION = process.env.S3_REGION || "fsn1";
const BUCKET = process.env.MEDIA_S3_BUCKET || "statthus-media";
const ACCESS_KEY = process.env.S3_ACCESS_KEY;
const SECRET_KEY = process.env.S3_SECRET_KEY;

const UPLOADS_SUBDIR = "assets/images/uploads"; // Quelle im Website-Repo
const MEDIA_ROOT = "uploads"; // Ziel-Wurzel im Bucket
const MAX_DIM = 2500;
const THUMB_DIM = 800;
const RASTER = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
const repoPath = args
  .filter((a, i) => !a.startsWith("--") && (onlyIdx < 0 || i !== onlyIdx + 1))
  .pop();

if (!repoPath) {
  console.error("Usage: node bin/migrate-media-to-s3.mjs [--dry-run] [--only <Ordner>] /pfad/zum/statthus-website");
  process.exit(1);
}
if (!dryRun && (!ACCESS_KEY || !SECRET_KEY)) {
  console.error("S3_ACCESS_KEY / S3_SECRET_KEY fehlen (Hetzner Console → Object Storage → Credentials)");
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: `https://${ENDPOINT}`,
  region: REGION,
  credentials: { accessKeyId: ACCESS_KEY || "", secretAccessKey: SECRET_KEY || "" },
  forcePathStyle: true,
});

const CONTENT_TYPES = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
};

async function put(key, body, contentType) {
  if (dryRun) return;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
}

async function optimize(buf, ext) {
  if (!RASTER.has(ext)) return { buf, width: null, height: null, thumb: null };
  let img = sharp(buf, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  if ((meta.width || 0) > MAX_DIM || (meta.height || 0) > MAX_DIM) {
    img = img.resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true });
  }
  if (ext === ".png") img = img.png({ compressionLevel: 9 });
  else if (ext === ".webp") img = img.webp({ quality: 82 });
  else img = img.jpeg({ quality: 82, mozjpeg: true });
  const { data, info } = await img.toBuffer({ resolveWithObject: true });
  const out = data.length < buf.length ? data : buf;
  const thumb = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({ width: THUMB_DIM, height: THUMB_DIM, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  return { buf: out, width: info.width, height: info.height, thumb };
}

// Rekursiv alle Ordner unter uploads/ einsammeln (relative Ordnerpfade).
async function walkDirs(dir, rel = "") {
  const dirs = [rel];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      dirs.push(...(await walkDirs(path.join(dir, entry.name), rel ? `${rel}/${entry.name}` : entry.name)));
    }
  }
  return dirs;
}

const srcRoot = path.join(repoPath, UPLOADS_SUBDIR);
await stat(srcRoot); // früh scheitern, wenn der Repo-Pfad nicht stimmt

let totalIn = 0, totalOut = 0, count = 0;

for (const relDir of await walkDirs(srcRoot)) {
  if (only && relDir !== only && !relDir.startsWith(`${only}/`)) continue;

  const absDir = path.join(srcRoot, relDir);
  const bucketDir = relDir ? `${MEDIA_ROOT}/${relDir}` : MEDIA_ROOT;
  const manifest = { images: [] };

  for (const entry of await readdir(absDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;

    const raw = await readFile(path.join(absDir, entry.name));
    const { buf, width, height, thumb } = await optimize(raw, ext);

    const key = `${bucketDir}/${entry.name}`;
    const base = entry.name.replace(/\.[^.]+$/, "");
    const tKey = thumb ? `${bucketDir}/_thumbs/${base}.webp` : null;

    await put(key, buf, CONTENT_TYPES[ext]);
    if (thumb && tKey) await put(tKey, thumb, "image/webp");

    manifest.images.push({ file: entry.name, src: key, thumb: tKey, width, height });
    totalIn += raw.length;
    totalOut += buf.length;
    count += 1;
    console.log(`${dryRun ? "[dry] " : ""}${key}  ${(raw.length / 1024).toFixed(0)}K → ${(buf.length / 1024).toFixed(0)}K`);
  }

  if (manifest.images.length > 0) {
    manifest.images.sort((a, b) => a.file.localeCompare(b.file, "de"));
    await put(`${bucketDir}/manifest.json`, JSON.stringify(manifest, null, 2), "application/json");
    console.log(`${dryRun ? "[dry] " : ""}${bucketDir}/manifest.json  (${manifest.images.length} Bilder)`);
  }
}

console.log(`\n${count} Bilder, ${(totalIn / 1024 / 1024).toFixed(1)} MB → ${(totalOut / 1024 / 1024).toFixed(1)} MB${dryRun ? " (dry-run, nichts hochgeladen)" : ""}`);
