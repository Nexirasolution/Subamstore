import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

export const runtime = 'nodejs';

// ── Limits ────────────────────────────────────────────────────────────────
const MAX_IMAGE_BYTES = 100 * 1024 * 1024; // raw upload ceiling; everything under it is compressed
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;  // videos are buffered in memory, keep modest
const MAX_IMAGE_WIDTH = 1920;
const MAX_INPUT_PIXELS = 100_000_000;      // decompression-bomb guard
const TARGET_BYTES = 400 * 1024;           // aim for output under ~400 KB
const QUALITY_STEPS = [80, 72, 64, 56, 48];
const WIDTH_STEPS = [1920, 1600, 1280, 1024];

// SVG is vector, so leave it as is. GIF is handled below (kept animated).
const PASSTHROUGH_IMAGES = new Set(['image/svg+xml']);

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

function safeExt(name) {
  return name?.includes('.')
    ? name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
    : '';
}

// Resize + convert to WebP. If the result is still too big, lower quality,
// then lower width, until it fits TARGET_BYTES (or we run out of steps).
async function compressImage(input, animated) {
  let best = null;

  for (const width of WIDTH_STEPS.filter((w) => w <= MAX_IMAGE_WIDTH)) {
    for (const quality of QUALITY_STEPS) {
      const out = await sharp(input, {
        failOn: 'none',
        limitInputPixels: MAX_INPUT_PIXELS,
        animated,
        sequentialRead: true,
      })
        .rotate() // apply EXIF orientation, strips metadata (incl. GPS)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toBuffer();

      if (!best || out.length < best.length) best = out;
      if (out.length <= TARGET_BYTES) return out;
    }
    // Animated images are expensive to retry many times, so stop after one width.
    if (animated) break;
  }
  return best; // smallest we could get
}

export async function POST(req) {
  let formData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 });
  }

  const file = formData.get('file');
  const rawFolder = formData.get('folder') || 'uploads';

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file' }, { status: 400 });
  }

  const type = file.type || '';
  const isImage = type.startsWith('image/');
  const isVideo = type.startsWith('video/');

  if (!isImage && !isVideo) {
    return NextResponse.json({ error: 'Only images and videos can be uploaded' }, { status: 415 });
  }

  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `File too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)` },
      { status: 413 }
    );
  }

  const folder =
    String(rawFolder)
      .replace(/[^a-zA-Z0-9/_-]/g, '')
      .split('/')
      .filter(Boolean)
      .join('/') || 'uploads';

  let body = Buffer.from(await file.arrayBuffer());
  let contentType = type || 'application/octet-stream';
  let ext = safeExt(file.name);

  // ── Always compress images (sharp is required, never silently skipped) ──
  if (isImage && !PASSTHROUGH_IMAGES.has(type)) {
    try {
      body = await compressImage(body, type === 'image/gif');
      contentType = 'image/webp';
      ext = 'webp';
    } catch (err) {
      console.error('Image processing failed:', err);
      return NextResponse.json({ error: 'Invalid or unsupported image' }, { status: 400 });
    }
  }

  const key = `${folder}/${randomUUID()}${ext ? `.${ext}` : ''}`;

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    return NextResponse.json({
      url: `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`,
      publicId: key,
    });
  } catch (err) {
    console.error('R2 upload failed:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}