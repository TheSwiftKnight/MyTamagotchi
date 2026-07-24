import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import dns from "node:dns";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createNarrativeGenerator, resolveLlmConfig } from "./llm-client.mjs";
import { loadEnvironment } from "./load-env.mjs";
import { PetPipeline, petUploadLimits } from "./pet-pipeline.mjs";
import { WorldEngine } from "./world-engine.mjs";

// This Mac's current network intermittently prefers an unreachable IPv6 route
// for GMI; Pocket Earth uses the same IPv4-first guard.
dns.setDefaultResultOrder("ipv4first");
await loadEnvironment();

const directory = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.WORLD_PORT || 8787);
const tickIntervalMs = Math.max(3000, Number(process.env.WORLD_TICK_INTERVAL_MS || 12000));
const llmConfig = resolveLlmConfig();
const engine = new WorldEngine({
  storagePath: process.env.WORLD_STATE_PATH || path.join(directory, "data", "world-state.json"),
  narrativeGenerator: createNarrativeGenerator(llmConfig),
});
const petPipeline = new PetPipeline({
  dataDir: path.join(directory, "data"),
  projectRoot: path.resolve(directory, ".."),
});

await engine.init();
await petPipeline.init();

let mutationQueue = Promise.resolve();
function mutate(operation) {
  mutationQueue = mutationQueue.then(operation, operation);
  return mutationQueue;
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Pet-Name,X-File-Name",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendBinary(response, status, payload, contentType) {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "private, no-store",
  });
  response.end(payload);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readImage(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > petUploadLimits.maxBytes) throw new Error("Image exceeds the 12MB upload limit");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") return sendJson(response, 204, {});
  const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);

  try {
    if (request.method === "GET" && url.pathname === "/api/health") {
      return sendJson(response, 200, {
        ok: true,
        service: "forkworld-engine",
        status: engine.state.meta.status,
        tick: engine.state.meta.tick,
        narrativeMode: llmConfig.enabled ? "llm-enabled" : "local",
        petPipeline: {
          configured: Boolean(process.env.GMI_API_KEY),
          storage: "temporary-private",
          stylize: `gmi:${process.env.GMI_SUBJECT_IMAGE_MODEL || process.env.GMI_PET_IMAGE_MODEL || "gpt-image-2-edit"}`,
          removeBackground: `gmi:${process.env.GMI_REMOVE_BG_MODEL || "bria-image-remove-background"}`,
        },
      });
    }
    if (request.method === "POST" && url.pathname === "/api/pets") {
      const mime = String(request.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      const source = await readImage(request);
      const job = petPipeline.submit(source, {
        mime,
        name: decodeURIComponent(String(request.headers["x-pet-name"] || "")),
        filename: decodeURIComponent(String(request.headers["x-file-name"] || "capture.jpg")),
      });
      return sendJson(response, 202, job);
    }
    const petRetryMatch = url.pathname.match(/^\/api\/pets\/(pet-[a-z0-9-]+)\/retry$/);
    if (request.method === "POST" && petRetryMatch) {
      return sendJson(response, 202, await petPipeline.retry(petRetryMatch[1], url.searchParams.get("accessToken") || ""));
    }
    const petJobMatch = url.pathname.match(/^\/api\/pets\/(pet-[a-z0-9-]+)$/);
    if (request.method === "GET" && petJobMatch) {
      const job = petPipeline.getJob(petJobMatch[1], url.searchParams.get("accessToken") || "");
      return job ? sendJson(response, 200, job) : sendJson(response, 404, { error: "Pet job not found" });
    }
    if (request.method === "DELETE" && petJobMatch) {
      const released = await petPipeline.release(petJobMatch[1], url.searchParams.get("accessToken") || "");
      return released
        ? sendJson(response, 200, { ok: true })
        : sendJson(response, 404, { error: "Pet job not found" });
    }
    const petFileMatch = url.pathname.match(/^\/api\/pets\/(pet-[a-z0-9-]+)\/files\/(source|clean|final)$/);
    if (request.method === "GET" && petFileMatch) {
      const filePath = petPipeline.resolveFile(petFileMatch[1], petFileMatch[2], url.searchParams.get("accessToken") || "");
      if (!filePath) return sendJson(response, 404, { error: "Pet image not found" });
      const payload = await readFile(filePath);
      const contentType = petFileMatch[2] === "source"
        ? ({ ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".heic": "image/heic", ".heif": "image/heif" }[path.extname(filePath)] || "application/octet-stream")
        : "image/png";
      return sendBinary(response, 200, payload, contentType);
    }
    if (request.method === "GET" && url.pathname === "/api/world") {
      return sendJson(response, 200, engine.snapshot());
    }
    if (request.method === "GET" && url.pathname === "/api/history") {
      const after = Number(url.searchParams.get("after") || 0);
      return sendJson(response, 200, { events: engine.state.events.filter(event => event.tick > after) });
    }
    if (request.method === "POST" && url.pathname === "/api/world/tick") {
      const body = await readJson(request);
      return sendJson(response, 200, await mutate(() => engine.step(body.steps)));
    }
    if (request.method === "POST" && url.pathname === "/api/world/run") {
      return sendJson(response, 200, await mutate(() => engine.setStatus("running")));
    }
    if (request.method === "POST" && url.pathname === "/api/world/pause") {
      return sendJson(response, 200, await mutate(() => engine.setStatus("paused")));
    }
    if (request.method === "POST" && url.pathname === "/api/world/reset") {
      return sendJson(response, 200, await mutate(() => engine.reset()));
    }

    const agentMatch = url.pathname.match(/^\/api\/agents\/([a-z0-9-]+)$/);
    if (request.method === "GET" && agentMatch) {
      const agent = engine.state.agents.find(item => item.id === agentMatch[1]);
      return agent ? sendJson(response, 200, agent) : sendJson(response, 404, { error: "Agent not found" });
    }
    const chatMatch = url.pathname.match(/^\/api\/agents\/([a-z0-9-]+)\/chat$/);
    if (request.method === "POST" && chatMatch) {
      const body = await readJson(request);
      const result = await mutate(() => engine.chatWithAgent(chatMatch[1], body.message));
      return result ? sendJson(response, 200, result) : sendJson(response, 404, { error: "Agent not found" });
    }

    return sendJson(response, 404, { error: "Route not found" });
  } catch (error) {
    return sendJson(response, 400, { error: error.message });
  }
});

const timer = setInterval(() => {
  if (engine.state.meta.status === "running") mutate(() => engine.step(1)).catch(error => {
    console.error("Autonomous tick failed:", error.message);
  });
}, tickIntervalMs);
timer.unref();

server.listen(port, "127.0.0.1", () => {
  console.log(`ForkWorld engine: http://127.0.0.1:${port}`);
  console.log(`Narrative mode: ${llmConfig.enabled ? `LLM (${llmConfig.model})` : "local deterministic"}`);
});

function shutdown() {
  clearInterval(timer);
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
