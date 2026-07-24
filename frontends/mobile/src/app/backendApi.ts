// FastAPI 后端客户端：agents / plaza / skills / forge / learn
const API_BASE = (import.meta.env.VITE_WORLD_API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "");
const API_ORIGIN = API_BASE.replace(/\/api$/, "");

/** 把后端返回的相对资源路径（如 /api/pets/xx/files/final）解析成可加载的 URL。 */
export function resolveApiAssetUrl(url: string): string {
  if (!url) return url;
  return url.startsWith("http") || url.startsWith("blob:") || url.startsWith("data:")
    ? url
    : `${API_ORIGIN}${url}`;
}

export const ME_USER_ID = 1;

/** agent 唯一的位置：一定在自己的三个世界之一或广场。 */
export type AgentLocation = "vitality-gym-town" | "learning-commons" | "maker-harbor" | "plaza";

export const AGENT_LOCATION_LABEL: Record<AgentLocation, string> = {
  "vitality-gym-town": "活力健身世界",
  "learning-commons": "学习教育世界",
  "maker-harbor": "创造协作世界",
  "plaza": "广场",
};

export type BackendSkillRow = {
  id: number;
  agent_id: number;
  name: string;
  description: string;
  code: string;
  source: string;
  kind: string;
  def_id: string;
  manifest: string;
};

export type BackendMemory = {
  id: number;
  agent_id: number;
  kind: string;
  content: string;
  created_at: string;
};

export type BackendAgent = {
  id: number;
  owner_id: number;
  owner_name: string;
  name: string;
  category: string;
  image: string; // agent 外表：capture 管线生成的角色图 URL
  trait: string;
  mood: number;
  location: AgentLocation;
  profile: string; // JSON: identity 字段 + memory_digest（随互动更新）
};

export type BackendAgentDetail = BackendAgent & {
  memories: BackendMemory[];
  skills: BackendSkillRow[];
};

export type CatalogSkill = {
  id: number;
  def_id: string;
  name: string;
  emoji: string;
  category: string;
  summary: string;
  capabilities: string[];
  kind: string;
  source: string;
  runnable: boolean;
  manifest: string;
  holder: {
    id: number;
    name: string;
    image: string;
    owner_name: string;
    location: string;
  } | null;
};

export type DialogLine = { agent_id: number; name: string; image: string; text: string };

/** 图鉴模板：无主人、无记忆，复制时才在 DB 建 agent 档案。 */
export type AgentTemplateRow = {
  id: number;
  name: string;
  category: string;
  image: string;
  trait: string;
  description: string;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body as any)?.detail ?? `请求失败 (${res.status})`);
  }
  return res.json();
}

export const backendApi = {
  agents: (ownerId?: number) =>
    req<BackendAgent[]>(`/agents${ownerId != null ? `?owner_id=${ownerId}` : ""}`),
  agent: (id: number) => req<BackendAgentDetail>(`/agents/${id}`),
  patchAgent: (
    id: number,
    patch: Partial<{
      name: string;
      trait: string;
      location: AgentLocation;
      profile: Record<string, unknown>;
    }>,
  ) => req<BackendAgent>(`/agents/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  chat: (agentId: number, text: string) =>
    req<{ reply: string; mood: number }>(`/agents/${agentId}/chat`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  plazaAgents: () => req<BackendAgent[]>("/plaza"),
  plazaConverse: () =>
    req<{ lines: DialogLine[]; learned: { learner: string; learner_id: number; teacher: string; skill: string } | null }>(
      "/plaza/converse",
      { method: "POST" },
    ),
  worldConverse: (location?: AgentLocation) =>
    req<{ lines: DialogLine[] }>("/world/converse", {
      method: "POST",
      body: JSON.stringify({ user_id: ME_USER_ID, location: location ?? null }),
    }),
  diary: (text: string, location?: AgentLocation) =>
    req<{ agent: BackendAgent; reply: string }>("/diary", {
      method: "POST",
      body: JSON.stringify({ user_id: ME_USER_ID, text, location: location ?? null }),
    }),
  templates: () => req<AgentTemplateRow[]>("/templates"),
  adoptTemplate: (templateId: number, name?: string) =>
    req<BackendAgent>(`/templates/${templateId}/adopt`, {
      method: "POST",
      body: JSON.stringify({ owner_id: ME_USER_ID, name: name ?? null }),
    }),
  plazaSkills: () => req<CatalogSkill[]>("/skills?location=plaza"),
  allSkills: () => req<CatalogSkill[]>("/skills"),
  learn: (skillId: number, learnerId?: number) =>
    req<{
      lines: DialogLine[];
      learner: BackendAgent;
      teacher: BackendAgent;
      skill: string;
      already_known: boolean;
    }>("/plaza/learn", {
      method: "POST",
      body: JSON.stringify({ skill_id: skillId, learner_id: learnerId ?? null }),
    }),
  forge: (prompt: string, agentId?: number) =>
    req<{
      output: string;
      skill: CatalogSkill;
      manifest: Record<string, unknown> & {
        name: string;
        emoji: string;
        def_id: string;
        category: string;
        description: string;
        capabilities: string[];
        inputs: { key: string; label: string; type: string; options?: string[] }[];
      };
      agent: BackendAgent;
    }>("/skills/forge", {
      method: "POST",
      body: JSON.stringify({ prompt, agent_id: agentId ?? null }),
    }),
  invokeSkill: (agentId: number, skillId: number, inputs: Record<string, string>) =>
    req<{ output: string; mood: number }>(`/agents/${agentId}/skills/${skillId}/invoke`, {
      method: "POST",
      body: JSON.stringify({ inputs }),
    }),
};
