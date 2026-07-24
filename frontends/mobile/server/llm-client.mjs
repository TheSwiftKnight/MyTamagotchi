function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function stripCodeFence(value) {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

export function resolveLlmConfig(env = process.env) {
  const apiKey = env.LLM_API_KEY || env.DASHSCOPE_API_KEY || env.DEEPSEEK_API_KEY || env.GMI_API_KEY || "";
  const explicitBaseUrl = env.LLM_BASE_URL || env.GMI_BASE_URL;
  let baseUrl = explicitBaseUrl || "https://api.openai.com/v1";
  if (!explicitBaseUrl && env.DASHSCOPE_API_KEY) baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
  if (!explicitBaseUrl && env.DEEPSEEK_API_KEY) baseUrl = "https://api.deepseek.com/v1";

  return {
    enabled: env.WORLD_LLM_ENABLED === "true" && Boolean(apiKey),
    chatEnabled: env.AGENT_CHAT_LLM_ENABLED === "true" && Boolean(apiKey),
    apiKey,
    baseUrl: trimTrailingSlash(baseUrl),
    model: env.LLM_MODEL_NAME || env.QWEN_MODEL || env.GMI_MODEL || "gpt-4.1-mini",
    timeoutMs: Number(env.LLM_TIMEOUT_MS || 18000),
  };
}

export function createNarrativeGenerator(config = resolveLlmConfig()) {
  if (!config.enabled) return null;

  return async function generateNarrative(context) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    const compactAgents = context.agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      voice: agent.voice,
      goal: agent.goal,
      mood: agent.mood,
      values: agent.values,
      recentMemories: agent.memories.slice(-2).map(memory => memory.text),
    }));

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.9,
          max_tokens: 850,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "你是一个温柔像素世界的 Agent 自我进化叙事引擎。保留每个智能体独立的价值观、说话方式、记忆与自主性；他们可以争论，不要强迫即时共识。生成一件规模很小但会留下后果的事件，重点表现 Agent 如何从记忆和反馈中自我学习，提出、研究、练习、验证或回滚一项 Skill，并把通过验证的能力用于下一次行动。语言复杂度必须符合当前文明阶段。所有面向用户的文字必须使用自然、简洁的中文；地点名、智能体姓名、时代名和 Skill 可以保留英文。返回严格 JSON，字段为 title、summary、dialogue、consequence、moodByAgent、optionalNewBelief、stances。dialogue 为每个智能体各一行，使用 agentId/text；每行只写一至两句短句，不超过 45 个汉字。stances 为每个智能体各一项，使用 agentId、kind（propose|question|support|mediate）和 summary。对话必须明确提到自我进化、自我学习或 Skill 研究中的至少一项，并具体说明学到了什么、如何验证或下一步怎样使用。",
            },
            {
              role: "user",
              content: JSON.stringify({
                civilization: context.civilization,
                era: context.era,
                tick: context.tick,
                seedEvent: context.seedEvent,
                agents: compactAgents,
              }),
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`LLM request failed with ${response.status}`);
      const payload = await response.json();
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("LLM response did not contain content");
      return JSON.parse(stripCodeFence(content));
    } finally {
      clearTimeout(timeout);
    }
  };
}

export function createAgentChatGenerator(config = resolveLlmConfig()) {
  if (!config.chatEnabled) return null;

  return async function generateAgentReply({ agent, message, history, memories }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    const memoryText = memories.length
      ? memories.map(item => `- ${item.text}`).join("\n")
      : "（还没有与这次谈话相关的长期记忆）";

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.82,
          max_tokens: 220,
          messages: [
            {
              role: "system",
              content: [
                "你是 Agent 世界里用户自己的长期陪伴智能体。",
                `名字：${agent.name}；角色：${agent.role}；目标：${agent.goal}；说话气质：${agent.voice}。`,
                "请使用自然、温暖、简洁的中文，以第一人称回应，不超过 100 个汉字。",
                "只在确实相关时自然引用长期记忆，不要声称记得未提供的事情，也不要替用户做高风险决定。",
                `相关长期记忆：\n${memoryText}`,
              ].join("\n"),
            },
            ...history.slice(-10).map(item => ({
              role: item.role === "agent" ? "assistant" : "user",
              content: item.text,
            })),
            { role: "user", content: message },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`LLM request failed with ${response.status}`);
      const payload = await response.json();
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("LLM response did not contain content");
      return content.slice(0, 240);
    } finally {
      clearTimeout(timeout);
    }
  };
}
