export type WorldStatus = "running" | "paused";

export type WorldMemory = {
  id: string;
  tick: number;
  type: "episodic" | "visitor";
  text: string;
  importance: number;
  emotion: string;
  participants: string[];
};

export type AgentChatMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
  createdAt: string;
  recalledMemoryIds: string[];
};

export type AgentLongTermMemory = {
  id: string;
  text: string;
  source: "conversation" | "manual";
  importance: number;
  pinned: boolean;
  createdAt: string;
  lastRecalledAt: string | null;
  recallCount: number;
};

export type AgentConversation = {
  agent: {
    id: string;
    name: string;
    role: string;
    color: string;
    location: string;
    mood: string;
    goal: string;
  };
  messages: AgentChatMessage[];
  memories: AgentLongTermMemory[];
};

export type AgentChatReply = {
  agentId: string;
  response: string;
  memoryAccepted: boolean;
  acceptedMemory: AgentLongTermMemory | null;
  recalledMemories: AgentLongTermMemory[];
  message: AgentChatMessage;
};

export type WorldReflection = {
  tick: number;
  text: string;
  changedTrait: string;
  newBelief: string;
};

export type WorldAgent = {
  id: string;
  name: string;
  role: string;
  world: string;
  color: string;
  location: string;
  goal: string;
  mood: string;
  energy: number;
  personalityVersion: number;
  lastActiveTick: number;
  memories: WorldMemory[];
  reflections: WorldReflection[];
  relationships: Record<string, { affinity: number; trust: number; sharedEvents: number; lastChangedAt: number }>;
};

export type WorldEvent = {
  id: string;
  tick: number;
  day: number;
  minute: number;
  type: string;
  location: string;
  title: string;
  summary: string;
  participants: string[];
  dialogue: { agentId: string; text: string }[];
  consequence: string;
  phase?: {
    name: string;
    focus: string;
    complexity: number;
  };
  action?: {
    type: string;
    label: string;
    target: string;
  };
  stances?: {
    agentId: string;
    kind: "propose" | "question" | "support" | "mediate";
    summary: string;
  }[];
  civilizationDelta: Record<string, number>;
  createdAt: string;
};

export type WorldState = {
  meta: {
    version: number;
    status: WorldStatus;
    tick: number;
    day: number;
    minute: number;
    era: string;
    eraNumber: number;
    startedAt: string;
    lastTickAt: string | null;
    narrativeMode: "local" | "llm" | "local-fallback";
  };
  civilization: {
    name: string;
    stage: string;
    credo: string;
    values: string[];
    metrics: Record<"cohesion" | "knowledge" | "creativity" | "stewardship", number>;
    resources: Record<string, number>;
    institutions: { id: string; name: string; purpose: string; foundedAt: number }[];
    discoveries: { tick: number; title: string; text: string }[];
    milestones: { tick: number; title: string; text: string }[];
    tensions: string[];
  };
  agents: WorldAgent[];
  events: WorldEvent[];
};

const API_BASE = (import.meta.env.VITE_WORLD_API_URL || "http://127.0.0.1:8787/api").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `World engine returned ${response.status}`);
  }
  return response.json();
}

export const worldApi = {
  getWorld: () => request<WorldState>("/world"),
  tick: (steps = 1) => request<WorldState>("/world/tick", { method: "POST", body: JSON.stringify({ steps }) }),
  run: () => request<WorldState>("/world/run", { method: "POST" }),
  pause: () => request<WorldState>("/world/pause", { method: "POST" }),
  reset: () => request<WorldState>("/world/reset", { method: "POST" }),
  getAgentConversation: (agentId: string) => request<AgentConversation>(`/agents/${agentId}/conversation`),
  chatWithAgent: (agentId: string, message: string, remember = true) => request<AgentChatReply>(`/agents/${agentId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message, remember }),
  }),
  addAgentMemory: (agentId: string, text: string) => request<{ memory: AgentLongTermMemory }>(`/agents/${agentId}/memories`, {
    method: "POST",
    body: JSON.stringify({ text }),
  }),
  deleteAgentMemory: (agentId: string, memoryId: string) => request<{ ok: true }>(`/agents/${agentId}/memories/${memoryId}`, {
    method: "DELETE",
  }),
};
