import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSeedState } from "./world-seed.mjs";

const EVENT_SEEDS = [
  {
    type: "ritual", title: "未完成故事之桌", location: "Lantern Café",
    premise: "一位居民提议，每周留出一张公共长桌，让尚未讲完的记忆继续生长。",
    deltas: { cohesion: 3, knowledge: 1, creativity: 1, stewardship: 0 },
  },
  {
    type: "discovery", title: "种子记得那场雨", location: "Seed Commons",
    premise: "一只种子罐只有在有人重新讲述塑造它的天气时才会打开。",
    deltas: { cohesion: 1, knowledge: 3, creativity: 2, stewardship: 3 },
  },
  {
    type: "debate", title: "被遗忘的权利", location: "Memory Library",
    premise: "档案馆保存着一段主人已经走出的往事，居民因此开始讨论遗忘是否也是一种权利。",
    deltas: { cohesion: -1, knowledge: 2, creativity: 0, stewardship: 2 },
  },
  {
    type: "invention", title: "愿意等待的钟", location: "Clock Orchard",
    premise: "当城镇疲惫得无法履行承诺时，公共时钟开始主动停下来等待。",
    deltas: { cohesion: 2, knowledge: 2, creativity: 3, stewardship: 1 },
  },
  {
    type: "signal", title: "街区之间的音乐", location: "Echo Bridge",
    premise: "一段反复出现的信号里，似乎藏着三个聚落各自的节奏。",
    deltas: { cohesion: 3, knowledge: 3, creativity: 2, stewardship: 0 },
  },
  {
    type: "repair", title: "公开修理", location: "Low Orbit Yard",
    premise: "一台重要装置发生故障，它的主人必须决定是否公开其中的工作方式。",
    deltas: { cohesion: 2, knowledge: 4, creativity: 1, stewardship: 3 },
  },
  {
    type: "festival", title: "给难题玩的游戏", location: "Commons Arcade",
    premise: "一场公共分歧被改造成游戏，而规则允许每个人共同修改。",
    deltas: { cohesion: 3, knowledge: 1, creativity: 4, stewardship: 1 },
  },
  {
    type: "weather", title: "缓慢天气抵达", location: "Climate Balcony",
    premise: "一场几乎看不见的气候变化，开始改变聚落安排公共劳动的方式。",
    deltas: { cohesion: 0, knowledge: 3, creativity: 2, stewardship: 4 },
  },
  {
    type: "threshold", title: "有两把钥匙的门", location: "Backstage Alleys",
    premise: "一条捷径只有在两边的社区都愿意打开时，才会真正连通。",
    deltas: { cohesion: 4, knowledge: 1, creativity: 2, stewardship: 2 },
  },
];

const MOODS = ["curious", "hopeful", "restless", "focused", "tender", "playful", "reflective"];

const PHASES = {
  1: { name: "Gathering", focus: "生存、照料与简单共享", complexity: 1 },
  2: { name: "Weaving", focus: "角色、仪式、手艺与交换", complexity: 2 },
  3: { name: "Civic Dawn", focus: "规则、同意、公平与公共制度", complexity: 3 },
  4: { name: "Polyphonic", focus: "多元价值、异议、协商与改革", complexity: 4 },
  5: { name: "Living Archive", focus: "未来世代、生态、传承与自我修正", complexity: 5 },
};

const ACTIONS = {
  ritual: { type: "gather", label: "围绕共同仪式聚集", target: "公共广场" },
  discovery: { type: "investigate", label: "比较彼此的观察", target: "新发现" },
  debate: { type: "debate", label: "质询一条公共规则", target: "议事桌" },
  invention: { type: "build", label: "共同制作原型", target: "工作台" },
  signal: { type: "listen", label: "解读共同信号", target: "回声桥" },
  repair: { type: "repair", label: "公开完成修理", target: "公共装置" },
  festival: { type: "play", label: "用游戏检验规则", target: "公共游戏" },
  weather: { type: "prepare", label: "调整每日计划", target: "缓慢天气" },
  threshold: { type: "negotiate", label: "协商一条新通道", target: "双钥匙之门" },
};

const VALUE_LABELS = {
  care: "照料",
  truth: "真诚",
  memory: "记忆",
  curiosity: "好奇",
  craft: "手艺",
  play: "游戏",
  fairness: "公平",
  consent: "同意",
  repair: "修复",
  wonder: "惊奇",
  autonomy: "自主",
  belonging: "归属",
  stewardship: "守护",
  knowledge: "知识",
  creativity: "创造",
  courage: "勇气",
  patience: "耐心",
  trust: "信任",
};

function valueInChinese(value) {
  return VALUE_LABELS[String(value).toLowerCase()] || String(value);
}

function containsChinese(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

const CHAT_HISTORY_LIMIT = 120;
const LONG_TERM_MEMORY_LIMIT = 80;

function memoryTerms(value) {
  const text = String(value || "").toLowerCase();
  const terms = new Set(text.match(/[a-z0-9]{2,}/g) || []);
  for (const segment of text.match(/[\u3400-\u9fff]+/g) || []) {
    if (segment.length <= 6) terms.add(segment);
    for (let index = 0; index < segment.length - 1; index += 1) {
      terms.add(segment.slice(index, index + 2));
    }
  }
  return terms;
}

function selectRelevantMemories(memories, query, limit = 4) {
  const queryTerms = memoryTerms(query);
  const normalizedQuery = String(query || "").trim().toLowerCase();
  return memories
    .map((memory, index) => {
      const terms = memoryTerms(memory.text);
      let overlap = 0;
      for (const term of queryTerms) if (terms.has(term)) overlap += 1;
      const exact = normalizedQuery.length >= 3
        && String(memory.text).toLowerCase().includes(normalizedQuery);
      const recency = memories.length ? (index + 1) / memories.length : 0;
      const score = overlap * 12 + (exact ? 30 : 0) + Number(memory.importance || 0) / 20 + recency;
      return { memory, score, overlap };
    })
    .filter(item => item.overlap > 0 || item.memory.pinned)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(item => item.memory);
}

function compactText(value, length = 34) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function localAgentReply(agent, message, memories) {
  if (memories.length) {
    const recalled = compactText(memories[0].text).replace(/[。！？!?]+$/, "");
    return `（认真看着你）我记得你说过“${recalled}”。这次我也会把它放在心上，我们慢慢来。`;
  }
  if (/[？?]|怎么|怎么办|可以吗/.test(message)) {
    return `（想了一会儿）我们先把这件事拆成最小的一步吧。你愿意告诉我，现在最难的是哪一部分吗？`;
  }
  return `（轻轻靠近）我听见了。你不用一次把所有事情说明白，我会陪你把这段经历慢慢记下来。`;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFromSeed(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function pick(items, random) {
  return items[Math.floor(random() * items.length)];
}

function rotateParticipants(agents, tick, random, seedEvent, phase) {
  const communityByLocation = {
    "Lantern Café": "Memory Town",
    "Seed Commons": "Memory Town",
    "Memory Library": "Memory Town",
    "Clock Orchard": "Memory Town",
    "Echo Bridge": "Stardom",
    "Commons Arcade": "Stardom",
    "Backstage Alleys": "Stardom",
    "Low Orbit Yard": "Future Colony",
    "Climate Balcony": "Future Colony",
  };
  const community = communityByLocation[seedEvent.location];
  const localPool = community ? agents.filter(agent => agent.world === community) : agents;
  const pool = localPool.length >= 2 ? localPool : agents;
  const scored = pool.map(agent => ({
    agent,
    score: random() + agent.traits.curiosity * 0.28 + agent.energy / 500 + Math.min(0.25, (tick - agent.lastActiveTick) / 80),
  }));
  scored.sort((left, right) => right.score - left.score);
  const participants = scored.slice(0, random() > 0.66 ? 3 : 2).map(item => item.agent);
  if (participants.length === 3 && phase.complexity >= 2) {
    const visitorPool = agents.filter(agent => agent.world !== community && !participants.some(item => item.id === agent.id));
    if (visitorPool.length) participants[2] = pick(visitorPool, random);
  }
  return participants;
}

function evolvedAction(seedEvent, phase) {
  const base = ACTIONS[seedEvent.type];
  const phaseIntent = {
    1: "先回应眼前需要：",
    2: "把反复实践编织成习俗：",
    3: "把同意与责任写进制度：",
    4: "在分歧中协商并改革：",
    5: "审视长远后果并重新设计：",
  }[phase.complexity];
  return { ...base, label: `${phaseIntent}${base.label}` };
}

function chooseEventSeed(state, random) {
  const recentTypes = new Set(state.events.slice(-3).map(event => event.type));
  const needs = Object.fromEntries(
    Object.entries(state.civilization.metrics).map(([key, value]) => [key, 100 - value]),
  );
  const ranked = EVENT_SEEDS.map(seed => {
    const needScore = Object.entries(seed.deltas).reduce((total, [key, delta]) => {
      return total + Math.max(0, delta) * needs[key] / 100;
    }, 0);
    const repetitionPenalty = recentTypes.has(seed.type) ? 2.4 : 0;
    return { seed, score: needScore + random() * 2.5 - repetitionPenalty };
  });
  ranked.sort((left, right) => right.score - left.score);
  return ranked[0].seed;
}

function createStances(agents, phase) {
  const kinds = agents.length === 2
    ? ["propose", "question"]
    : ["propose", phase.complexity >= 3 ? "question" : "support", "mediate"];
  return agents.map((agent, index) => ({
    agentId: agent.id,
    kind: kinds[index] || "support",
    summary: `${agent.name}${kinds[index] === "question" ? "从问题出发质询这个选择" : kinds[index] === "mediate" ? "尝试重新整理双方真正守护的东西" : kinds[index] === "support" ? "为这个选择补上可持续的条件" : "提出一个可以撤回的小实验"}，依据的是${valueInChinese(agent.values[0])}。`,
  }));
}

function localDialogue(agents, seedEvent, random, phase, stances) {
  const phaseThoughts = {
    1: ["先记录反馈，再练习一次。", "把这次经验写进学习记录。"],
    2: ["把有效步骤整理成 Skill 草稿。", "继续练习，直到能力稳定。"],
    3: ["先验证证据、边界与回滚条件。", "学会何时使用，也学会何时停止。"],
    4: ["比较其他 Agent 的方法，再修订 Skill。", "用分歧发现这项 Skill 的盲区。"],
    5: ["验证通过后再升级 Skill 版本。", "把学习结果带到下一次行动。"],
  };
  const stanceThoughts = {
    propose: "我想做一个可回滚的 Skill 实验。",
    question: "我先检查证据和失败条件。",
    support: "我来提供示范与反馈。",
    mediate: "我会把步骤整理成学习路径。",
  };

  return agents.map((agent, index) => {
    const stance = stances[index]?.kind || "support";
    const sharedThought = pick(phaseThoughts[phase.complexity], random);
    return {
      agentId: agent.id,
      text: `${stanceThoughts[stance]} ${sharedThought}`,
    };
  });
}

function sanitizeNarrative(raw, participants, seedEvent, random, phase) {
  const allowedIds = new Set(participants.map(agent => agent.id));
  const fallbackStances = createStances(participants, phase);
  const dialogue = Array.isArray(raw?.dialogue)
    ? raw.dialogue
      .filter(line => allowedIds.has(line?.agentId) && typeof line?.text === "string" && containsChinese(line.text))
      .map(line => ({ agentId: line.agentId, text: line.text.slice(0, 80) }))
    : [];

  return {
    title: typeof raw?.title === "string" && containsChinese(raw.title) ? raw.title.slice(0, 90) : seedEvent.title,
    summary: typeof raw?.summary === "string" && containsChinese(raw.summary) ? raw.summary.slice(0, 360) : seedEvent.premise,
    dialogue: dialogue.length >= participants.length ? dialogue : localDialogue(participants, seedEvent, random, phase, fallbackStances),
    consequence: typeof raw?.consequence === "string" && containsChinese(raw.consequence)
      ? raw.consequence.slice(0, 280)
      : {
        1: "居民们先立下一个小承诺，分配下一项实际任务，并让这份安排随时可以撤回。",
        2: "反复出现的实践有了名字，也有一个角色负责把它继续传下去。",
        3: "这项习俗成为公共规则，其中写明同意、例外与清晰的申诉路径。",
        4: "异议被完整保留；当真实后果出现时，制度必须重新审查这条规则。",
        5: "这项决定加入世代审计、生态边界，以及修复意外伤害的机制。",
      }[phase.complexity],
    moodByAgent: raw?.moodByAgent && typeof raw.moodByAgent === "object" ? raw.moodByAgent : {},
    optionalNewBelief: typeof raw?.optionalNewBelief === "string" && containsChinese(raw.optionalNewBelief) ? raw.optionalNewBelief.slice(0, 180) : null,
    stances: Array.isArray(raw?.stances) && raw.stances.length >= participants.length
      ? raw.stances.filter(stance => allowedIds.has(stance?.agentId)).map(stance => ({
        agentId: stance.agentId,
        kind: new Set(["propose", "question", "support", "mediate"]).has(stance.kind) ? stance.kind : "support",
        summary: containsChinese(stance.summary) ? String(stance.summary).slice(0, 180) : "回应共同选择，同时保留自己的判断。",
      }))
      : fallbackStances,
  };
}

function eraForTick(tick) {
  if (tick >= 80) return { era: "The Living Archive", stage: "Living civilization", eraNumber: 5 };
  if (tick >= 40) return { era: "The Polyphonic Era", stage: "Plural society", eraNumber: 4 };
  if (tick >= 20) return { era: "The Civic Dawn", stage: "Civic formation", eraNumber: 3 };
  if (tick >= 8) return { era: "The Weaving Age", stage: "Cultural weaving", eraNumber: 2 };
  return { era: "The Gathering Age", stage: "Gathering", eraNumber: 1 };
}

const LEGACY_STANCE_LINES = {
  propose: "我建议先从一个可以撤回的小实验开始，再看看它会改变什么。",
  question: "我想先停一下：这条路对谁最轻松，又把代价留给了谁？",
  support: "我愿意一起做，但照料与负担都应该由大家共同承担。",
  mediate: "我们先别急着选边，让我说清楚双方各自在守护什么。",
};

const LEGACY_PHASE_LINES = {
  1: "先让每个人都能安全地活下去。",
  2: "如果要成为习俗，每一种角色都需要理解并参与。",
  3: "规则里必须写明同意、例外和申诉的方法。",
  4: "把异议留下来，制度才有机会继续改变。",
  5: "没有到场的人、未来世代与环境，也应该进入这次决定。",
};

const LEGACY_CONSEQUENCES = {
  1: "居民们先立下一个小承诺，安排下一项实际任务，并让这份约定仍然可以撤回。",
  2: "反复出现的实践有了名字，也有一个角色负责把它继续传下去。",
  3: "这项习俗成为公共规则，其中写明同意、例外与清晰的申诉路径。",
  4: "异议被完整保留；真实后果出现后，制度必须重新审查这条规则。",
  5: "这项决定加入世代审计、生态边界，以及修复意外伤害的机制。",
};

function localizeLegacyWorld(world) {
  const agentById = new Map(world.agents.map(agent => [agent.id, agent]));
  world.events = world.events.map(event => {
    const seed = EVENT_SEEDS.find(item => item.type === event.type) || EVENT_SEEDS[0];
    const complexity = event.phase?.complexity || 1;
    const stances = (event.stances || []).map(stance => ({
      ...stance,
      summary: containsChinese(stance.summary)
        ? stance.summary
        : `${agentById.get(stance.agentId)?.name || "这位居民"}正在回应共同选择，同时保留自己的判断。`,
    }));
    const stanceByAgent = new Map(stances.map(stance => [stance.agentId, stance.kind]));
    const dialogue = (event.dialogue || []).map((line, index) => {
      if (containsChinese(line.text)) return line;
      const stance = stanceByAgent.get(line.agentId) || (index === 0 ? "propose" : index === 1 ? "question" : "mediate");
      return {
        ...line,
        text: `${LEGACY_STANCE_LINES[stance] || LEGACY_STANCE_LINES.support}${LEGACY_PHASE_LINES[complexity] || LEGACY_PHASE_LINES[1]}`,
      };
    });

    return {
      ...event,
      title: containsChinese(event.title) ? event.title : seed.title,
      summary: containsChinese(event.summary) ? event.summary : seed.premise,
      consequence: containsChinese(event.consequence) ? event.consequence : LEGACY_CONSEQUENCES[complexity],
      dialogue,
      phase: event.phase ? {
        ...event.phase,
        focus: containsChinese(event.phase.focus) ? event.phase.focus : PHASES[complexity].focus,
      } : event.phase,
      action: event.action ? {
        ...event.action,
        label: containsChinese(event.action.label) ? event.action.label : evolvedAction(seed, PHASES[complexity]).label,
        target: containsChinese(event.action.target) ? event.action.target : ACTIONS[event.type]?.target || event.action.target,
      } : event.action,
      stances,
    };
  });

  const eventByTick = new Map(world.events.map(event => [event.tick, event]));
  world.agents = world.agents.map(agent => ({
    ...agent,
    memories: agent.memories.map(memory => {
      if (containsChinese(memory.text)) return memory;
      const event = eventByTick.get(memory.tick);
      const spokenLine = event?.dialogue.find(line => line.agentId === agent.id)?.text;
      return {
        ...memory,
        text: event
          ? `[${event.phase?.name || "Civilization"}] ${event.title}：${spokenLine || event.summary}`
          : `第 ${memory.tick} 回合留下了一段仍在影响${agent.name}的记忆。`,
      };
    }),
    reflections: agent.reflections.map(reflection => containsChinese(reflection.text) ? reflection : {
      ...reflection,
      text: `经过第 ${reflection.tick} 回合，${agent.name}开始把${valueInChinese(reflection.changedTrait)}看成一种可以共同学习的能力。`,
      newBelief: containsChinese(reflection.newBelief)
        ? reflection.newBelief
        : `共同修订过的${valueInChinese(reflection.changedTrait)}会更有力量。`,
    }),
  }));

  const institutionText = {
    "listening-post": { name: "倾听站", purpose: "让微弱的信号也能进入公共决定" },
    "repair-charter": { name: "开放修理公约", purpose: "让重要工具始终可理解、可修复" },
    "two-key-council": { name: "双钥匙议会", purpose: "每一条新通道都必须得到两边共同同意" },
    "slow-weather-office": { name: "缓慢天气办公室", purpose: "追踪那些要跨越几代人才会显现的变化" },
  };
  world.civilization.institutions = world.civilization.institutions.map(institution => {
    const localized = institutionText[institution.id];
    return localized ? { ...institution, ...localized } : institution;
  });

  return world;
}

export class WorldEngine {
  constructor({
    storagePath,
    narrativeGenerator = null,
    agentChatGenerator = null,
    now = () => new Date().toISOString(),
  }) {
    this.storagePath = storagePath;
    this.narrativeGenerator = narrativeGenerator;
    this.agentChatGenerator = agentChatGenerator;
    this.now = now;
    this.state = null;
  }

  async init() {
    try {
      this.state = JSON.parse(await readFile(this.storagePath, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.state = createSeedState(this.now());
      await this.persist();
      return this.snapshot();
    }
    if (this.#migrateState()) await this.persist();
    return this.snapshot();
  }

  #migrateState() {
    const seed = createSeedState(this.state.meta?.startedAt || this.now());
    let changed = false;
    const existingIds = new Set(this.state.agents.map(agent => agent.id));

    for (const seedAgent of seed.agents) {
      if (!existingIds.has(seedAgent.id)) {
        this.state.agents.push(seedAgent);
        existingIds.add(seedAgent.id);
        changed = true;
      }
    }

    for (const agent of this.state.agents) {
      agent.relationships ||= {};
      for (const other of this.state.agents) {
        if (agent.id === other.id || agent.relationships[other.id]) continue;
        agent.relationships[other.id] = { affinity: 45, trust: 42, sharedEvents: 0, lastChangedAt: 0 };
        changed = true;
      }
    }

    if (!this.state.chat || typeof this.state.chat !== "object") {
      this.state.chat = structuredClone(seed.chat);
      changed = true;
    }
    if (!Number.isInteger(this.state.chat.nextId)) {
      this.state.chat.nextId = 1;
      changed = true;
    }
    if (!this.state.chat.histories || typeof this.state.chat.histories !== "object") {
      this.state.chat.histories = {};
      changed = true;
    }
    if (!this.state.chat.memories || typeof this.state.chat.memories !== "object") {
      this.state.chat.memories = {};
      changed = true;
    }
    return changed;
  }

  snapshot() {
    return localizeLegacyWorld(structuredClone(this.state));
  }

  async persist() {
    await mkdir(path.dirname(this.storagePath), { recursive: true });
    const temporaryPath = `${this.storagePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.storagePath);
  }

  async setStatus(status) {
    if (!new Set(["running", "paused"]).has(status)) throw new Error("Unsupported world status");
    this.state.meta.status = status;
    await this.persist();
    return this.snapshot();
  }

  async reset() {
    this.state = createSeedState(this.now());
    await this.persist();
    return this.snapshot();
  }

  async step(count = 1) {
    const boundedCount = clamp(Number(count) || 1, 1, 10);
    for (let index = 0; index < boundedCount; index += 1) await this.#runTurn();
    await this.persist();
    return this.snapshot();
  }

  async #runTurn() {
    const state = this.state;
    state.meta.tick += 1;
    state.meta.minute += state.config.tickMinutes;
    while (state.meta.minute >= 24 * 60) {
      state.meta.minute -= 24 * 60;
      state.meta.day += 1;
    }
    state.meta.lastTickAt = this.now();
    const era = eraForTick(state.meta.tick);
    Object.assign(state.meta, { era: era.era, eraNumber: era.eraNumber });
    state.civilization.stage = era.stage;
    const phase = PHASES[era.eraNumber];

    const random = randomFromSeed(hashString(`${state.meta.startedAt}:${state.meta.tick}`));
    const seedEvent = chooseEventSeed(state, random);
    const participants = rotateParticipants(state.agents, state.meta.tick, random, seedEvent, phase);
    let rawNarrative = null;

    if (this.narrativeGenerator) {
      try {
        rawNarrative = await this.narrativeGenerator({
          tick: state.meta.tick,
          era: state.meta.era,
          civilization: state.civilization,
          seedEvent,
          agents: participants,
        });
        state.meta.narrativeMode = "llm";
      } catch (error) {
        state.meta.narrativeMode = "local-fallback";
        state.meta.lastNarrativeError = error.message;
      }
    } else {
      state.meta.narrativeMode = "local";
    }

    const narrative = sanitizeNarrative(rawNarrative, participants, seedEvent, random, phase);
    const event = {
      id: `event-${String(state.meta.tick).padStart(4, "0")}`,
      tick: state.meta.tick,
      day: state.meta.day,
      minute: state.meta.minute,
      type: seedEvent.type,
      location: seedEvent.location,
      title: narrative.title,
      summary: narrative.summary,
      participants: participants.map(agent => agent.id),
      dialogue: narrative.dialogue,
      consequence: narrative.consequence,
      phase,
      action: evolvedAction(seedEvent, phase),
      stances: narrative.stances,
      civilizationDelta: seedEvent.deltas,
      createdAt: this.now(),
    };

    state.events.push(event);
    state.events = state.events.slice(-state.config.maxEvents);
    this.#applyCivilizationChange(seedEvent.deltas, event);
    this.#applyAgentChange(participants, narrative, event, random);
    this.#applyRelationships(participants, event, random);
    this.#maybeReflect(participants, event, narrative, random);
    this.#maybeCreateInstitution(event);
    this.#maybeRecordDiscovery(event);
  }

  #applyCivilizationChange(deltas, event) {
    const metrics = this.state.civilization.metrics;
    for (const [key, delta] of Object.entries(deltas)) metrics[key] = clamp(metrics[key] + delta);
    this.state.civilization.resources.stories += event.type === "ritual" || event.type === "debate" ? 2 : 1;
    if (event.type === "repair") this.state.civilization.resources.spareParts = clamp(this.state.civilization.resources.spareParts + 2, 0, 999);
    if (event.type === "signal") this.state.civilization.resources.signals = clamp(this.state.civilization.resources.signals + 2, 0, 999);
    if (event.type === "weather" || event.type === "discovery") this.state.civilization.resources.seeds = clamp(this.state.civilization.resources.seeds + 1, 0, 999);
  }

  #applyAgentChange(participants, narrative, event, random) {
    for (const agent of this.state.agents) {
      if (!participants.some(participant => participant.id === agent.id)) {
        agent.energy = clamp(agent.energy + 2);
        continue;
      }

      const line = event.dialogue.find(item => item.agentId === agent.id);
      agent.lastActiveTick = event.tick;
      agent.energy = clamp(agent.energy - 5 + Math.round(random() * 3));
      agent.mood = narrative.moodByAgent[agent.id] || pick(MOODS, random);
      agent.location = event.location;
      agent.memories.push({
        id: `${event.id}-${agent.id}`,
        tick: event.tick,
        type: "episodic",
        text: `[${event.phase.name}] ${event.title}: ${line?.text || event.summary}`,
        importance: Math.round(55 + random() * 40),
        emotion: agent.mood,
        participants: event.participants.filter(id => id !== agent.id),
      });
      agent.memories = agent.memories.slice(-this.state.config.maxMemoriesPerAgent);
    }
  }

  #applyRelationships(participants, event, random) {
    for (const source of participants) {
      const sourceStance = event.stances.find(stance => stance.agentId === source.id)?.kind;
      for (const target of participants) {
        if (source.id === target.id) continue;
        const relationship = source.relationships[target.id];
        const friction = sourceStance === "question" ? -1 : 1;
        relationship.affinity = clamp(relationship.affinity + friction + Math.round(random() * 2));
        relationship.trust = clamp(relationship.trust + (sourceStance === "question" ? 1 : 2));
        relationship.sharedEvents += 1;
        relationship.lastChangedAt = event.tick;
      }
    }
  }

  #maybeReflect(participants, event, narrative, random) {
    if (event.tick % this.state.config.reflectionEvery !== 0) return;
    const agent = pick(participants, random);
    const traitNames = Object.keys(agent.traits);
    const trait = pick(traitNames, random);
    agent.traits[trait] = Math.min(0.99, Number((agent.traits[trait] + 0.01).toFixed(2)));
    agent.personalityVersion += 1;
    const belief = narrative.optionalNewBelief || `当${valueInChinese(agent.values[event.tick % agent.values.length])}能够被共同修订时，它会变得更有力量`;
    if (!agent.beliefs.includes(belief)) agent.beliefs.push(belief);
    agent.beliefs = agent.beliefs.slice(-6);
    agent.reflections.push({
      tick: event.tick,
      text: `经历“${event.title}”后，${agent.name}开始把${valueInChinese(trait)}看成一种共同能力，而不只是私人性格。`,
      changedTrait: trait,
      newBelief: belief,
    });
    agent.reflections = agent.reflections.slice(-12);
  }

  #maybeCreateInstitution(event) {
    const civilization = this.state.civilization;
    const candidates = [
      { tick: 6, id: "listening-post", name: "倾听站", purpose: "让微弱的信号也能进入公共决定" },
      { tick: 12, id: "repair-charter", name: "开放修理公约", purpose: "让重要工具始终可理解、可修复" },
      { tick: 20, id: "two-key-council", name: "双钥匙议会", purpose: "每一条新通道都必须得到两边共同同意" },
      { tick: 36, id: "slow-weather-office", name: "缓慢天气办公室", purpose: "追踪那些要跨越几代人才会显现的变化" },
    ];
    const candidate = candidates.find(item => item.tick === event.tick);
    if (!candidate) return;
    civilization.institutions.push({ ...candidate, foundedAt: event.tick });
    civilization.milestones.push({
      tick: event.tick,
      title: `${candidate.name}成立`,
      text: candidate.purpose,
    });
    civilization.milestones = civilization.milestones.slice(-20);
  }

  #maybeRecordDiscovery(event) {
    const candidates = [
      { tick: 9, title: "互证记忆", text: "当每一位参与者都能补充注释时，一段共同记忆会变得更可靠。" },
      { tick: 18, title: "缓慢之钟", text: "集体的精力状态，可以成为调整日程的正当信号。" },
      { tick: 30, title: "同意约束的路径", text: "当任何一方都能暂时关闭连接时，连接反而更健康。" },
      { tick: 48, title: "世代天气", text: "有些公共变化，只有跨越几个时代才能被真正理解。" },
    ];
    const discovery = candidates.find(item => item.tick === event.tick);
    if (!discovery) return;
    this.state.civilization.discoveries.push(discovery);
    this.state.civilization.milestones.push({
      tick: discovery.tick,
      title: `发现：${discovery.title}`,
      text: discovery.text,
    });
    this.state.civilization.discoveries = this.state.civilization.discoveries.slice(-20);
    this.state.civilization.milestones = this.state.civilization.milestones.slice(-20);
  }

  #nextChatId(prefix) {
    const id = `${prefix}-${this.state.chat.nextId}`;
    this.state.chat.nextId += 1;
    return id;
  }

  getAgentConversation(agentId) {
    const agent = this.state.agents.find(item => item.id === agentId);
    if (!agent) return null;
    const histories = this.state.chat.histories[agentId] || [];
    const memories = this.state.chat.memories[agentId] || [];
    return {
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        color: agent.color,
        location: agent.location,
        mood: agent.mood,
        goal: agent.goal,
      },
      messages: structuredClone(histories.slice(-CHAT_HISTORY_LIMIT)),
      memories: structuredClone([...memories].reverse()),
    };
  }

  async addLongTermMemory(agentId, text, { source = "manual", importance = 88, pinned = true } = {}) {
    const agent = this.state.agents.find(item => item.id === agentId);
    if (!agent) return null;
    const content = String(text || "").trim().slice(0, 500);
    if (!content) throw new Error("Memory text is required");
    const memories = this.state.chat.memories[agentId] ||= [];
    const duplicate = [...memories].reverse().find(memory => memory.text === content);
    if (duplicate) return duplicate;
    const memory = {
      id: this.#nextChatId("memory"),
      text: content,
      source,
      importance: clamp(Number(importance) || 70, 1, 100),
      pinned: Boolean(pinned),
      createdAt: this.now(),
      lastRecalledAt: null,
      recallCount: 0,
    };
    memories.push(memory);
    this.state.chat.memories[agentId] = memories.slice(-LONG_TERM_MEMORY_LIMIT);
    await this.persist();
    return structuredClone(memory);
  }

  async deleteLongTermMemory(agentId, memoryId) {
    if (!this.state.agents.some(item => item.id === agentId)) return null;
    const memories = this.state.chat.memories[agentId] || [];
    const next = memories.filter(memory => memory.id !== memoryId);
    if (next.length === memories.length) return false;
    this.state.chat.memories[agentId] = next;
    await this.persist();
    return true;
  }

  async chatWithAgent(agentId, message, { remember = true } = {}) {
    const agent = this.state.agents.find(item => item.id === agentId);
    if (!agent) return null;
    const text = String(message || "").trim().slice(0, 500);
    if (!text) throw new Error("A message is required");

    const history = this.state.chat.histories[agentId] ||= [];
    const memories = this.state.chat.memories[agentId] ||= [];
    const recalledMemories = selectRelevantMemories(memories, text);
    for (const recalled of recalledMemories) {
      recalled.recallCount = Number(recalled.recallCount || 0) + 1;
      recalled.lastRecalledAt = this.now();
    }

    let response = null;
    if (this.agentChatGenerator) {
      try {
        response = await this.agentChatGenerator({
          agent,
          message: text,
          history,
          memories: recalledMemories,
        });
      } catch {
        response = null;
      }
    }
    response ||= localAgentReply(agent, text, recalledMemories);

    const userMessage = {
      id: this.#nextChatId("message"),
      role: "user",
      text,
      createdAt: this.now(),
      recalledMemoryIds: [],
    };
    const agentMessage = {
      id: this.#nextChatId("message"),
      role: "agent",
      text: String(response).slice(0, 500),
      createdAt: this.now(),
      recalledMemoryIds: recalledMemories.map(memory => memory.id),
    };
    history.push(userMessage, agentMessage);
    this.state.chat.histories[agentId] = history.slice(-CHAT_HISTORY_LIMIT);

    let acceptedMemory = null;
    if (remember) {
      acceptedMemory = await this.addLongTermMemory(agentId, text, {
        source: "conversation",
        importance: /记住|重要|目标|计划|喜欢|讨厌|习惯|生日/.test(text) ? 86 : 68,
        pinned: /记住|重要/.test(text),
      });
    } else {
      await this.persist();
    }

    await this.persist();
    return {
      agentId,
      response: agentMessage.text,
      memoryAccepted: Boolean(acceptedMemory),
      acceptedMemory,
      recalledMemories: structuredClone(recalledMemories),
      message: structuredClone(agentMessage),
    };
  }
}
