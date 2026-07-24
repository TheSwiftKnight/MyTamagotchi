# ForkWorld evolution engine

This directory is a standalone ForkWorld service. MiroFish was studied as an
architectural reference only; its repository is not modified and this service
does not import from it.

The engine keeps five concerns separate:

1. **Persona** — stable drives, values, voice, goals, and slowly changing traits.
2. **Memory** — bounded episodic memories plus explicit visitor memories.
3. **Relationships** — directed affinity, trust, and shared-event history.
4. **Simulation** — round scheduling, event selection, dialogue, action, and reflection.
5. **Civilization** — eras, public metrics, institutions, resources, tensions, and canon.

The frontend calls endpoints at `http://127.0.0.1:8787/api`. World state is
persisted to `server/data/world-state.json` with atomic writes.

The Capture flow is backed by the same service. It accepts a photo, sends that
photo through GMI's `gpt-image-2-edit` model to classify and preserve the
dominant person, animal, or physical object while redrawing it as one complete
ForkWorld-style character on a flat `#00FF00` background. Cropped subjects are
conservatively completed from the visible anatomy or design before the
generated illustration is sent through GMI's
`bria-image-remove-background` model. The final artifact is a verified
transparent PNG. Source and generated files exist only inside a private,
token-scoped temporary job. The browser downloads them into page-local Blob
URLs and then deletes the server job. Abandoned jobs expire after 30 minutes,
and a service restart clears all interrupted jobs.

The service rejects generated images that contain multiple large subjects,
touch the canvas edge, lack the required solid-color padding, or fail to
produce real transparency. Failed jobs retain their source image only for the
temporary retry window. A missing
`GMI_API_KEY` is reported as a real pipeline error; the backend never presents
a demo sprite as if it were generated from the user's photo.

## Run

```bash
npm run dev
```

The default command starts both the service and Vite. Use `npm run frontend`
or `npm run backend` when only one process is needed. The default narrative
generator is deterministic and local. To opt into an OpenAI-compatible model,
copy `.env.example` to `.env`, set `WORLD_LLM_ENABLED=true`, and provide a key,
base URL, and model. Existing DashScope, DeepSeek, and GMI variable names are
also recognized. A separate environment file can be loaded explicitly with
`WORLD_ENV_FILE=/absolute/path/to/.env npm run backend`.

## API

- `GET /api/health`
- `GET /api/world`
- `GET /api/history?after=<tick>`
- `POST /api/world/tick` with `{ "steps": 1 }`
- `POST /api/world/run`
- `POST /api/world/pause`
- `POST /api/world/reset`
- `GET /api/agents/:id`
- `POST /api/agents/:id/chat` with `{ "message": "..." }`
- `POST /api/pets` with raw JPEG, PNG, WebP, HEIC, or HEIF bytes (maximum 12MB)
- `GET /api/pets/:id?accessToken=...`
- `POST /api/pets/:id/retry?accessToken=...`
- `DELETE /api/pets/:id?accessToken=...`
- `GET /api/pets/:id/files/source|clean|final?accessToken=...`

Generated Agents are never added to a shared backend list or to the shared
world state.

## Subject-to-Agent pipeline configuration

```env
GMI_API_KEY=your_key
GMI_CONSOLE_BASE=https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey
GMI_SUBJECT_IMAGE_MODEL=gpt-image-2-edit
GMI_REMOVE_BG_MODEL=bria-image-remove-background
```

`GMI_PET_IMAGE_MODEL` remains supported as a backwards-compatible fallback.
The image-edit prompt classifies the dominant source subject as a person,
animal, or physical object, preserves its identity and shape, and completes
cropped subjects into one full, centered mascot before background removal.

An existing trusted environment file can be reused without copying its key:

```bash
WORLD_ENV_FILE="/absolute/path/to/.env" npm run backend
```

Alibaba Cloud `SegmentCommonImage` was evaluated as a background-removal
alternative. Its official contract accepts animals and objects but explicitly
states that cartoon images are not supported, so it is not used after the
illustration stage. The old Glass Menagerie `/api/glassify` proxy also depends
on an external OSS URL and an opaque remote service. Bria is therefore the
deterministic production path for the generated illustration.
