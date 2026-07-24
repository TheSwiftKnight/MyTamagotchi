import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const JOB_TTL_MS = 30 * 60 * 1000;
const SUPPORTED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const GMI_QUEUE_BASE = "https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey";
const GMI_IMAGE_MODEL = "gpt-image-2-edit";
const GMI_REMOVE_BG_MODEL = "bria-image-remove-background";
const SUBJECT_PROMPT_VERSION = "forkworld-subject-v3";
const CHROMA_BACKGROUND = "#00FF00";

export const SUBJECT_STYLE_PROMPT = [
  "Treat this as a faithful image-to-image character conversion, not free-form generation.",
  "First inspect the uploaded photo and identify its single visually dominant primary subject as a person, an animal, or a physical object. Keep that category exactly; never default to an animal and never replace the subject with a different category.",
  "The uploaded subject is the sole identity and shape reference. Preserve its recognizable silhouette, proportions, orientation, pose, colors, materials, patterns, markings, facial or identity cues, clothing, accessories, and distinctive structural details.",
  "Always output exactly one complete, fully visible, uncropped subject. If the source is a bust, half-body, close-up, cropped, partly outside the frame, occluded, or missing limbs or other parts, conservatively reconstruct every missing part into a plausible complete full body or complete object. The completion must continue the visible anatomy, design, scale, perspective, clothing, material, and colors; do not invent a different identity.",
  "For a person: create a cute full-body version while retaining recognizable face cues, hairstyle, skin tone, body proportions, clothing colors, and accessories. If only the upper body is visible, infer the lower body and outfit naturally and conservatively.",
  "For an animal: retain its species, body proportions, coat colors and markings, ears, muzzle, limbs, and tail, and reconstruct any cropped anatomy into the same individual.",
  "For an object: retain its object category, original silhouette, structure, functional parts, material, colors, and recognizable details, and reconstruct any cropped physical parts. Do not turn the object into a person or animal.",
  "Visual style: one charming minimalist ForkWorld mascot illustration with rounded geometric simplification, thick slightly imperfect black hand-drawn outlines, warm flat color fills, two oversized round white eyes with small black pupils, tiny black oval feet where appropriate, very short simple limbs where appropriate, low detail, and a friendly emotionally warm expression. Apply this style without losing the source subject's identity or shape.",
  "Place the complete subject in the center at a readable size with generous empty padding on every side.",
  `Use one perfectly flat, uniform, opaque ${CHROMA_BACKGROUND} background. Every background pixel must be the same color.`,
  "Do not create a lineup, comparison sheet, alternate design, companion, duplicate subject, extra person, extra animal, extra object, or partial subject at any edge.",
  "No scenery, floor, shadow, glow, gradient, paper texture, text, watermark, border, unreferenced accessories, duplicated body parts, or photorealism.",
].join(" ");

function safeName(value) {
  return String(value || "新伙伴").trim().slice(0, 24) || "新伙伴";
}

function publicJob(job) {
  return {
    id: job.id,
    accessToken: job.accessToken,
    name: job.name,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    ...(job.error ? { error: job.error } : {}),
    ...(job.asset ? { asset: { ...job.asset } } : {}),
  };
}

function extensionForMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic") return "heic";
  if (mime === "image/heif") return "heif";
  return "jpg";
}

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporaryPath, filePath);
}

function resultUrl(payload) {
  const media = payload?.outcome?.media_urls;
  return media?.[0]?.url
    || payload?.outcome?.thumbnail_image_url
    || payload?.data?.[0]?.url
    || payload?.data?.url
    || payload?.output?.url
    || payload?.url
    || "";
}

async function fetchNetworkRetry(url, options, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const { timeoutMs, ...fetchOptions } = options;
      return await fetch(url, {
        ...fetchOptions,
        signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : fetchOptions.signal,
      });
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) {
        await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
  }
  const detail = lastError?.cause?.code || lastError?.cause?.message;
  throw new Error(detail ? `${lastError.message}: ${detail}` : lastError.message);
}

export async function normalizeGmiUpload(input, mime) {
  if (!["image/webp", "image/heic", "image/heif"].includes(mime)) return { input, mime };
  return { input: await sharp(input).rotate().png().toBuffer(), mime: "image/png" };
}

async function uploadToGmi(rawInput, rawMime) {
  if (!process.env.GMI_API_KEY) throw new Error("GMI_API_KEY is not configured");
  const { input, mime } = await normalizeGmiUpload(rawInput, rawMime);
  const base = process.env.GMI_CONSOLE_BASE || GMI_QUEUE_BASE;
  const fileType = mime === "image/png" ? "png" : "jpg";
  // GMI's signed upload ticket currently signs JPG objects as image/jpg.
  // Sending the otherwise-standard image/jpeg makes the object store reject
  // the PUT with a signature mismatch.
  const signedContentType = fileType === "jpg" ? "image/jpg" : "image/png";
  const ticketResponse = await fetchNetworkRetry(`${base}/upload-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GMI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file_type: fileType }),
    timeoutMs: 30_000,
  });
  const ticket = await ticketResponse.json().catch(() => ({}));
  if (!ticketResponse.ok || !ticket.upload_url || !ticket.public_url) {
    throw new Error(`GMI upload ticket failed (${ticketResponse.status})`);
  }
  const uploadResponse = await fetchNetworkRetry(ticket.upload_url, {
    method: "PUT",
    headers: { "Content-Type": signedContentType },
    body: input,
    timeoutMs: 60_000,
  });
  if (!uploadResponse.ok) throw new Error(`GMI source upload failed (${uploadResponse.status})`);
  return ticket.public_url;
}

async function findGmiRequest(base, authorization, model, payload) {
  const listResponse = await fetchNetworkRetry(`${base}/requests?model_id=${encodeURIComponent(model)}`, {
    headers: { Authorization: authorization },
    timeoutMs: 30_000,
  });
  const listPayload = await listResponse.json().catch(() => ({}));
  if (!listResponse.ok) throw new Error(`GMI ${model} recovery query failed (${listResponse.status})`);
  const requests = Array.isArray(listPayload)
    ? listPayload
    : (listPayload.requests || listPayload.data || []);
  return [...requests]
    .sort((left, right) => Number(right.created_at || 0) - Number(left.created_at || 0))
    .find(item => item?.payload?.image === payload.image && item?.payload?.prompt === payload.prompt);
}

async function submitGmiRequest(model, payload, { recoverExisting = false, onRequest } = {}) {
  if (!process.env.GMI_API_KEY) throw new Error("GMI_API_KEY is not configured");
  const base = process.env.GMI_CONSOLE_BASE || GMI_QUEUE_BASE;
  const headers = {
    Authorization: `Bearer ${process.env.GMI_API_KEY}`,
    "Content-Type": "application/json",
  };
  let submitted;
  let createError;
  if (recoverExisting) {
    submitted = await findGmiRequest(base, headers.Authorization, model, payload);
  }
  try {
    if (!submitted) {
      const response = await fetch(`${base}/requests`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model, payload }),
        // GMI sometimes keeps this connection open until generation finishes.
        signal: AbortSignal.timeout(180_000),
      });
      submitted = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`GMI ${model} request failed (${response.status}): ${submitted.error || submitted.message || "unknown error"}`);
    }
  } catch (error) {
    createError = error;
  }

  if (createError) {
    // The GMI console occasionally closes a long-running create connection
    // even though it accepted the job. Recover that exact job instead of
    // retrying the paid generation and creating duplicates.
    submitted = await findGmiRequest(base, headers.Authorization, model, payload);
    if (!submitted) throw createError;
  }

  let url = resultUrl(submitted);
  if (url) return url;
  const requestId = submitted.request_id || submitted.requestId || submitted.id;
  if (!requestId) throw new Error(`GMI ${model} returned neither an image nor a request id`);
  await onRequest?.(requestId);

  for (let attempt = 0; attempt < 150; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 2_000));
    const statusResponse = await fetch(`${base}/requests/${encodeURIComponent(requestId)}`, {
      headers: { Authorization: headers.Authorization },
      signal: AbortSignal.timeout(30_000),
    });
    const status = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) {
      if (statusResponse.status >= 500) continue;
      throw new Error(`GMI ${model} status failed (${statusResponse.status})`);
    }
    url = resultUrl(status);
    if (url) return url;
    const state = String(status.status || "").toLowerCase();
    if (["failed", "error", "cancelled", "canceled"].includes(state)) {
      throw new Error(`GMI ${model} failed: ${status.error || status.message || state}`);
    }
  }
  throw new Error(`GMI ${model} timed out`);
}

async function downloadImage(url, label) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`${label} download failed (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

function countLargeComponents(mask, width, height) {
  const visited = new Uint8Array(mask.length);
  const componentSizes = [];
  const queue = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    let size = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const index = queue[head++];
      size += 1;
      const x = index % width;
      const y = Math.floor(index / width);
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < width ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y + 1 < height ? index + width : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && mask[neighbor] && !visited[neighbor]) {
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
    }
    componentSizes.push(size);
  }
  const foreground = componentSizes.reduce((total, size) => total + size, 0);
  const minimumLargeSize = Math.max(12, Math.round(foreground * 0.08));
  return componentSizes.filter(size => size >= minimumLargeSize).length;
}

export async function flattenChromaBackground(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const total = info.width * info.height;
  const background = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isGreen = pixel => {
    const offset = pixel * info.channels;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    return alpha >= 220 && green >= 120 && green >= red * 1.35 && green >= blue * 1.35;
  };
  const enqueue = pixel => {
    if (pixel < 0 || pixel >= total || background[pixel] || !isGreen(pixel)) return;
    background[pixel] = 1;
    queue[tail++] = pixel;
  };

  for (let x = 0; x < info.width; x += 1) {
    enqueue(x);
    enqueue((info.height - 1) * info.width + x);
  }
  for (let y = 0; y < info.height; y += 1) {
    enqueue(y * info.width);
    enqueue(y * info.width + info.width - 1);
  }
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < info.width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - info.width);
    if (y + 1 < info.height) enqueue(pixel + info.width);
  }

  for (let pixel = 0; pixel < total; pixel += 1) {
    if (!background[pixel]) continue;
    const offset = pixel * info.channels;
    data[offset] = 0;
    data[offset + 1] = 255;
    data[offset + 2] = 0;
    data[offset + 3] = 255;
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function removeGreenSpill(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const offset = pixel * info.channels;
    const alpha = data[offset + 3];
    if (!alpha) continue;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    if (green > red * 1.12 && green > blue * 1.12) {
      data[offset + 1] = Math.max(red, blue);
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

export async function validateStylizedSubject(input) {
  const normalized = await flattenChromaBackground(input);
  const { data, info } = await sharp(normalized)
    .resize(128, 128, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(info.width * info.height);
  let foreground = 0;
  let borderForeground = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const offset = pixel * info.channels;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    const isChroma = red <= 55 && green >= 200 && blue <= 55 && alpha >= 245;
    if (isChroma) continue;
    mask[pixel] = 1;
    foreground += 1;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    if (x <= 2 || y <= 2 || x >= info.width - 3 || y >= info.height - 3) borderForeground += 1;
  }
  const foregroundRatio = foreground / mask.length;
  if (foregroundRatio < 0.015) throw new Error("Generated image did not contain a visible subject");
  if (foregroundRatio > 0.62) throw new Error("Generated subject does not have enough solid-color padding");
  if (borderForeground > 2) throw new Error("Generated image contains a cropped subject at the canvas edge");
  if (countLargeComponents(mask, info.width, info.height) > 1) {
    throw new Error("Generated image contains more than one subject");
  }
  return normalized;
}

export async function validateTransparentSubject(input) {
  const normalized = await removeGreenSpill(input);
  const { data, info } = await sharp(normalized)
    .resize(128, 128, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let transparent = 0;
  let visible = 0;
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const alpha = data[pixel * info.channels + 3];
    if (alpha <= 8) transparent += 1;
    if (alpha >= 220) visible += 1;
  }
  const total = info.width * info.height;
  if (transparent / total < 0.25) throw new Error("Background removal did not produce a transparent PNG");
  if (visible / total < 0.01) throw new Error("Background removal erased the generated subject");
  return normalized;
}

async function stylizeWithGmi(source, mime, _filename, context = {}) {
  const image = context.generationInputUrl || await uploadToGmi(source, mime);
  if (!context.generationInputUrl) await context.onInputUploaded?.(image);
  const model = process.env.GMI_SUBJECT_IMAGE_MODEL || process.env.GMI_PET_IMAGE_MODEL || GMI_IMAGE_MODEL;
  const url = await submitGmiRequest(model, {
    prompt: SUBJECT_STYLE_PROMPT,
    image,
    size: "1024x1024",
    quality: "medium",
    n: 1,
  }, {
    recoverExisting: Boolean(context.generationInputUrl),
    onRequest: context.onRequest,
  });
  return downloadImage(url, "GMI cartoon image");
}

async function removeBackgroundWithGmi(input, context = {}) {
  const image = context.backgroundInputUrl || await uploadToGmi(input, "image/png");
  if (!context.backgroundInputUrl) await context.onInputUploaded?.(image);
  const model = process.env.GMI_REMOVE_BG_MODEL || GMI_REMOVE_BG_MODEL;
  const url = await submitGmiRequest(model, { image }, {
    recoverExisting: Boolean(context.backgroundInputUrl),
    onRequest: context.onRequest,
  });
  return downloadImage(url, "GMI transparent image");
}

export class PetPipeline {
  constructor({ dataDir, projectRoot, stylize = stylizeWithGmi, removeBackground = removeBackgroundWithGmi }) {
    this.dataDir = dataDir;
    this.assetDir = path.join(dataDir, "pet-assets");
    this.projectRoot = projectRoot;
    this.jobs = new Map();
    this.expiryTimers = new Map();
    this.stylize = stylize;
    this.removeBackground = removeBackground;
  }

  async init() {
    // Capture jobs are private, short-lived processing data. A restart clears
    // interrupted work instead of restoring it into a shared user-visible list.
    await rm(this.assetDir, { recursive: true, force: true });
    await mkdir(this.assetDir, { recursive: true });
  }

  submit(source, { filename = "capture.jpg", mime = "image/jpeg", name } = {}) {
    if (!Buffer.isBuffer(source) || !source.length) throw new Error("Image body is empty");
    if (source.length > MAX_UPLOAD_BYTES) throw new Error("Image exceeds the 12MB upload limit");
    if (!SUPPORTED_MIME.has(mime)) throw new Error("Only JPEG, PNG, WebP, and HEIC images are supported");

    const id = `pet-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const job = {
      id,
      accessToken: randomUUID(),
      name: safeName(name),
      status: "queued",
      stage: "upload",
      progress: 8,
      filename,
      mime,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(id, job);
    this.scheduleExpiry(job);
    this.process(job, source, { filename, mime }).catch(() => {});
    return publicJob(job);
  }

  getJob(id, accessToken) {
    const job = this.jobs.get(id);
    return job?.accessToken === accessToken ? publicJob(job) : null;
  }

  async retry(id, accessToken) {
    const job = this.jobs.get(id);
    if (!job || job.accessToken !== accessToken) throw new Error("Agent generation job not found");
    if (job.status === "queued" || job.status === "processing") throw new Error("Agent generation is still running");
    if (!job.sourceFile) throw new Error("Saved source image is missing");
    const source = await readFile(path.join(this.assetDir, id, job.sourceFile));
    this.update(job, {
      status: "queued",
      stage: "upload",
      progress: 8,
      error: undefined,
      asset: undefined,
    });
    await this.persistJob(job);
    this.scheduleExpiry(job);
    this.process(job, source, { filename: job.filename, mime: job.mime }).catch(() => {});
    return publicJob(job);
  }

  resolveFile(id, kind, accessToken) {
    if (!["source", "clean", "final"].includes(kind)) return null;
    const job = this.jobs.get(id);
    if (!job || job.accessToken !== accessToken) return null;
    const filename = kind === "source" ? job.sourceFile : kind === "clean" ? "clean.png" : "final.png";
    return filename ? path.join(this.assetDir, id, filename) : null;
  }

  scheduleExpiry(job) {
    const existing = this.expiryTimers.get(job.id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.release(job.id, job.accessToken).catch(() => {});
    }, JOB_TTL_MS);
    timer.unref?.();
    this.expiryTimers.set(job.id, timer);
  }

  async release(id, accessToken) {
    const job = this.jobs.get(id);
    if (!job || job.accessToken !== accessToken) return false;
    const timer = this.expiryTimers.get(id);
    if (timer) clearTimeout(timer);
    this.expiryTimers.delete(id);
    this.jobs.delete(id);
    await rm(path.join(this.assetDir, id), { recursive: true, force: true });
    return true;
  }

  update(job, patch) {
    Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  }

  async persistJob(job) {
    const itemDir = path.join(this.assetDir, job.id);
    await mkdir(itemDir, { recursive: true });
    await writeJsonAtomic(path.join(itemDir, "job.json"), job);
  }

  async process(job, source, { filename, mime }) {
    try {
      const itemDir = path.join(this.assetDir, job.id);
      await mkdir(itemDir, { recursive: true });
      const sourceFile = `source.${extensionForMime(mime)}`;
      await writeFile(path.join(itemDir, sourceFile), source);
      this.update(job, { sourceFile, status: "processing", stage: "stylize", progress: 28 });
      await this.persistJob(job);

      const clean = await validateStylizedSubject(await this.stylize(source, mime, filename, {
        generationInputUrl: job.generationInputUrl,
        onInputUploaded: async generationInputUrl => {
          this.update(job, { generationInputUrl });
          await this.persistJob(job);
        },
        onRequest: async generationRequestId => {
          this.update(job, { generationRequestId });
          await this.persistJob(job);
        },
      }));
      const stylizeProvider = `gmi:${process.env.GMI_SUBJECT_IMAGE_MODEL || process.env.GMI_PET_IMAGE_MODEL || GMI_IMAGE_MODEL}`;
      await writeFile(path.join(itemDir, "clean.png"), clean);
      this.update(job, { stage: "remove-background", progress: 68, stylizeProvider });
      await this.persistJob(job);

      const final = await validateTransparentSubject(await this.removeBackground(clean, {
        backgroundInputUrl: job.backgroundInputUrl,
        onInputUploaded: async backgroundInputUrl => {
          this.update(job, { backgroundInputUrl });
          await this.persistJob(job);
        },
        onRequest: async backgroundRequestId => {
          this.update(job, { backgroundRequestId });
          await this.persistJob(job);
        },
      }));
      const removeBackgroundProvider = `gmi:${process.env.GMI_REMOVE_BG_MODEL || GMI_REMOVE_BG_MODEL}`;
      await writeFile(path.join(itemDir, "final.png"), final);
      this.update(job, { stage: "localize", progress: 92, removeBackgroundProvider });
      await this.persistJob(job);

      const asset = {
        id: job.id,
        name: job.name,
        role: "萌化陪伴 Agent",
        world: "Memory Town",
        color: "#E8634A",
        sourceFile,
        sourceUrl: `/api/pets/${job.id}/files/source?accessToken=${encodeURIComponent(job.accessToken)}`,
        cleanUrl: `/api/pets/${job.id}/files/clean?accessToken=${encodeURIComponent(job.accessToken)}`,
        finalUrl: `/api/pets/${job.id}/files/final?accessToken=${encodeURIComponent(job.accessToken)}`,
        stylizeProvider,
        removeBackgroundProvider,
        promptVersion: SUBJECT_PROMPT_VERSION,
        backgroundColor: CHROMA_BACKGROUND,
        outputFormat: "image/png",
        createdAt: job.createdAt,
      };
      this.update(job, { status: "ready", stage: "complete", progress: 100, asset });
      await this.persistJob(job);
    } catch (error) {
      this.update(job, { status: "failed", stage: "failed", error: error.message });
      await this.persistJob(job);
    }
  }
}

export const petUploadLimits = {
  maxBytes: MAX_UPLOAD_BYTES,
  mimeTypes: [...SUPPORTED_MIME],
};
