export type PetAsset = {
  id: string;
  name: string;
  role: string;
  world: string;
  color: string;
  sourceUrl: string;
  cleanUrl: string;
  finalUrl: string;
  stylizeProvider: string;
  removeBackgroundProvider: string;
  promptVersion: string;
  backgroundColor: string;
  outputFormat: "image/png";
  createdAt: string;
  personality?: string[];
  temperament?: string;
  registeredAt?: string;
  agentId?: number;
};

export type PetJob = {
  id: string;
  accessToken: string;
  name: string;
  status: "queued" | "processing" | "ready" | "failed";
  stage: "upload" | "stylize" | "remove-background" | "localize" | "complete" | "failed";
  progress: number;
  error?: string;
  asset?: PetAsset;
};

const API_BASE = (import.meta.env.VITE_WORLD_API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "");
const API_ORIGIN = API_BASE.replace(/\/api$/, "");

function absoluteAssetUrls(asset: PetAsset): PetAsset {
  const resolve = (url: string) => url.startsWith("http") ? url : `${API_ORIGIN}${url}`;
  return {
    ...asset,
    sourceUrl: resolve(asset.sourceUrl),
    cleanUrl: resolve(asset.cleanUrl),
    finalUrl: resolve(asset.finalUrl),
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Agent pipeline returned ${response.status}`);
  return payload;
}

async function fetchApi(input: string, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error("生成服务未连接，请点击重试");
  }
}

export const petApi = {
  async submit(file: File, name?: string): Promise<PetJob> {
    const response = await fetchApi(`${API_BASE}/pets`, {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        "X-File-Name": encodeURIComponent(file.name),
        "X-Pet-Name": encodeURIComponent(name || file.name.replace(/\.[^.]+$/, "") || "新伙伴"),
      },
      body: file,
    });
    return readJson<PetJob>(response);
  },

  async getJob(id: string, accessToken: string): Promise<PetJob> {
    const job = await readJson<PetJob>(await fetchApi(`${API_BASE}/pets/${id}?accessToken=${encodeURIComponent(accessToken)}`, {
      cache: "no-store",
    }));
    return job.asset ? { ...job, asset: absoluteAssetUrls(job.asset) } : job;
  },

  async retry(job: PetJob): Promise<PetJob> {
    return readJson<PetJob>(await fetchApi(`${API_BASE}/pets/${job.id}/retry?accessToken=${encodeURIComponent(job.accessToken)}`, {
      method: "POST",
    }));
  },

  async register(id: string): Promise<PetAsset> {
    const payload = await readJson<{ asset: PetAsset }>(await fetchApi(`${API_BASE}/pets/${id}/register`, {
      method: "POST",
    }));
    return absoluteAssetUrls(payload.asset);
  },

  async localize(asset: PetAsset): Promise<PetAsset> {
    const blobs = await Promise.all(
      [asset.sourceUrl, asset.cleanUrl, asset.finalUrl].map(async url => {
        const response = await fetchApi(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`本机图片下载失败（${response.status}）`);
        return response.blob();
      }),
    );
    return {
      ...asset,
      sourceUrl: URL.createObjectURL(blobs[0]),
      cleanUrl: URL.createObjectURL(blobs[1]),
      finalUrl: URL.createObjectURL(blobs[2]),
    };
  },

  async release(id: string, accessToken: string): Promise<void> {
    await fetchApi(`${API_BASE}/pets/${id}?accessToken=${encodeURIComponent(accessToken)}`, {
      method: "DELETE",
      keepalive: true,
    }).catch(() => undefined);
  },
};

export async function waitForPet(submitted: PetJob, onProgress: (job: PetJob) => void) {
  for (let attempt = 0; attempt < 800; attempt += 1) {
    const job = await petApi.getJob(submitted.id, submitted.accessToken);
    onProgress(job);
    if (job.status === "ready" && job.asset) {
      // 自动建档：生成人设并写入后端 DB（inventory 日常精灵）。失败时仍返回本机资产。
      const registered = await petApi.register(job.id).catch(() => null);
      const localAsset = await petApi.localize(registered ?? job.asset);
      await petApi.release(job.id, job.accessToken);
      return localAsset;
    }
    if (job.status === "failed") throw new Error(job.error || "萌化 Agent 生成失败");
    await new Promise(resolve => window.setTimeout(resolve, 750));
  }
  throw new Error("萌化 Agent 生成超时，请稍后重试");
}
