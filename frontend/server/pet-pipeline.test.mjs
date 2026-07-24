import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";
import {
  SUBJECT_STYLE_PROMPT,
  PetPipeline,
  flattenChromaBackground,
  normalizeGmiUpload,
  petUploadLimits,
  validateStylizedSubject,
  validateTransparentSubject,
} from "./pet-pipeline.mjs";

async function makePetImage({ transparent = false, secondSubject = false } = {}) {
  const background = transparent
    ? { r: 0, g: 0, b: 0, alpha: 0 }
    : { r: 0, g: 255, b: 0, alpha: 1 };
  const subject = await sharp({
    create: { width: 48, height: 42, channels: 4, background: { r: 184, g: 137, b: 99, alpha: 1 } },
  }).png().toBuffer();
  const overlays = [{ input: subject, left: 40, top: 43 }];
  if (secondSubject) overlays.push({ input: subject, left: 2, top: 43 });
  return sharp({
    create: { width: 128, height: 128, channels: 4, background },
  }).composite(overlays).png().toBuffer();
}

async function waitForJob(pipeline, id, accessToken) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const job = pipeline.getJob(id, accessToken);
    if (job?.status === "ready" || job?.status === "failed") return job;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error("Test job did not finish");
}

test("subject pipeline keeps a generated Agent private until the client releases it", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "forkworld-pet-"));
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  try {
    const clean = await makePetImage();
    const final = await makePetImage({ transparent: true });
    const pipeline = new PetPipeline({
      dataDir,
      projectRoot,
      stylize: async () => clean,
      removeBackground: async () => final,
    });
    await pipeline.init();
    const source = await sharp({
      create: { width: 24, height: 24, channels: 3, background: "#b88963" },
    }).jpeg().toBuffer();
    const submitted = pipeline.submit(source, { filename: "pet.jpg", mime: "image/jpeg", name: "小栗" });
    const job = await waitForJob(pipeline, submitted.id, submitted.accessToken);

    assert.equal(job.status, "ready", job.error);
    assert.equal(job.asset.name, "小栗");
    assert.equal(pipeline.getJob(submitted.id, "another-phone"), null);
    assert.match(job.asset.stylizeProvider, /^gmi:/);
    assert.match(job.asset.removeBackgroundProvider, /^gmi:/);
    const finalPath = pipeline.resolveFile(submitted.id, "final", submitted.accessToken);
    const metadata = await sharp(await readFile(finalPath)).metadata();
    assert.equal(metadata.hasAlpha, true);
    assert.equal(pipeline.resolveFile(submitted.id, "final", "another-phone"), null);
    assert.equal(await pipeline.release(submitted.id, "another-phone"), false);
    assert.equal(await pipeline.release(submitted.id, submitted.accessToken), true);
    assert.equal(pipeline.getJob(submitted.id, submitted.accessToken), null);
    const recoveredPipeline = new PetPipeline({
      dataDir,
      projectRoot,
      stylize: async () => clean,
      removeBackground: async () => final,
    });
    await recoveredPipeline.init();
    assert.equal(recoveredPipeline.getJob(submitted.id, submitted.accessToken), null);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("failed visual QA can retry from the persisted source without another upload", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "forkworld-pet-retry-"));
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  let attempts = 0;
  try {
    const invalid = await makePetImage({ secondSubject: true });
    const valid = await makePetImage();
    const final = await makePetImage({ transparent: true });
    const pipeline = new PetPipeline({
      dataDir,
      projectRoot,
      stylize: async () => attempts++ === 0 ? invalid : valid,
      removeBackground: async () => final,
    });
    await pipeline.init();
    const source = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#b88963" },
    }).jpeg().toBuffer();
    const submitted = pipeline.submit(source, { filename: "pet.jpg", mime: "image/jpeg" });
    const failed = await waitForJob(pipeline, submitted.id, submitted.accessToken);
    assert.equal(failed.status, "failed");
    assert.match(failed.error, /more than one subject|canvas edge/);

    await pipeline.retry(submitted.id, submitted.accessToken);
    const retried = await waitForJob(pipeline, submitted.id, submitted.accessToken);
    assert.equal(retried.status, "ready", retried.error);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("GMI upload normalizes WebP and the prompt handles people, animals, objects, and cropped subjects", async () => {
  const webp = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#b88963" },
  }).webp().toBuffer();
  const normalized = await normalizeGmiUpload(webp, "image/webp");
  assert.equal(normalized.mime, "image/png");
  assert.equal((await sharp(normalized.input).metadata()).format, "png");
  assert.ok(petUploadLimits.mimeTypes.includes("image/heic"));
  assert.match(SUBJECT_STYLE_PROMPT, /person, an animal, or a physical object/);
  assert.match(SUBJECT_STYLE_PROMPT, /never default to an animal/);
  assert.match(SUBJECT_STYLE_PROMPT, /sole identity and shape reference/);
  assert.match(SUBJECT_STYLE_PROMPT, /bust, half-body, close-up, cropped/);
  assert.match(SUBJECT_STYLE_PROMPT, /fully visible, uncropped subject/);
  assert.match(SUBJECT_STYLE_PROMPT, /For a person:/);
  assert.match(SUBJECT_STYLE_PROMPT, /For an animal:/);
  assert.match(SUBJECT_STYLE_PROMPT, /For an object:/);
  assert.match(SUBJECT_STYLE_PROMPT, /#00FF00/);
});

test("visual QA rejects a generated lineup before background removal", async () => {
  await assert.rejects(
    validateStylizedSubject(await makePetImage({ secondSubject: true })),
    /more than one subject|canvas edge/,
  );
});

test("post-processing makes the model background exact and removes green edge spill", async () => {
  const subject = await sharp({
    create: { width: 32, height: 32, channels: 4, background: { r: 180, g: 100, b: 45, alpha: 1 } },
  }).png().toBuffer();
  const modelImage = await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 18, g: 235, b: 16, alpha: 1 } },
  }).composite([{ input: subject, left: 16, top: 16 }]).png().toBuffer();
  const flattened = await flattenChromaBackground(modelImage);
  const corner = await sharp(flattened).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
  assert.deepEqual([...corner.slice(0, 4)], [0, 255, 0, 255]);

  const transparent = await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 0 } },
  }).composite([{ input: subject, left: 16, top: 16 }]).png().toBuffer();
  const cleaned = await validateTransparentSubject(transparent);
  const edge = await sharp(cleaned).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
  assert.equal(edge[3], 0);
});
