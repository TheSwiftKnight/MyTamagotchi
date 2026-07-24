const AGENTS = [
  {
    id: "miko", name: "Miko", role: "Café Keeper", world: "Memory Town", object: "red mug",
    color: "#E8634A", location: "Lantern Café", voice: "warm, practical, and fond of tiny rituals",
    goal: "turn the café into a place where no memory feels too small to keep",
    drives: ["belonging", "care", "continuity"], values: ["hospitality", "patience", "shared stories"],
    traits: { curiosity: 0.62, empathy: 0.91, discipline: 0.72, courage: 0.54, imagination: 0.68 },
  },
  {
    id: "shutter", name: "Shutter", role: "Archivist", world: "Memory Town", object: "camera",
    color: "#4A7FA5", location: "Near Library", voice: "observant, precise, and quietly poetic",
    goal: "build an archive that remembers causes, not only outcomes",
    drives: ["truth", "memory", "pattern"], values: ["evidence", "context", "curiosity"],
    traits: { curiosity: 0.9, empathy: 0.58, discipline: 0.88, courage: 0.61, imagination: 0.72 },
  },
  {
    id: "nana", name: "Nana", role: "Comforter", world: "Memory Town", object: "beaded charm",
    color: "#C890C0", location: "Soft Garden", voice: "gentle, surprising, and emotionally direct",
    goal: "teach the town to treat rest as part of progress",
    drives: ["healing", "trust", "play"], values: ["kindness", "honesty", "rest"],
    traits: { curiosity: 0.6, empathy: 0.97, discipline: 0.47, courage: 0.71, imagination: 0.84 },
  },
  {
    id: "folio", name: "Folio", role: "Memory Librarian", world: "Memory Town", object: "blue notebook",
    color: "#4A7FA5", location: "Memory Library", voice: "careful, scholarly, and delighted by footnotes",
    goal: "create a living index that changes when the town changes",
    drives: ["order", "learning", "legacy"], values: ["access", "precision", "plurality"],
    traits: { curiosity: 0.83, empathy: 0.66, discipline: 0.94, courage: 0.48, imagination: 0.57 },
  },
  {
    id: "luma", name: "Luma", role: "Night Guide", world: "Stardom", object: "yellow lamp",
    color: "#D4A800", location: "Moonlit Steps", voice: "luminous, patient, and fond of riddles",
    goal: "map safe paths through every uncertain night",
    drives: ["guidance", "wonder", "safety"], values: ["clarity", "hope", "preparedness"],
    traits: { curiosity: 0.76, empathy: 0.79, discipline: 0.68, courage: 0.82, imagination: 0.9 },
  },
  {
    id: "beat", name: "Beat", role: "Signal Listener", world: "Stardom", object: "headphones",
    color: "#6B9E7A", location: "Echo Bridge", voice: "rhythmic, curious, and tuned to what goes unsaid",
    goal: "compose a common rhythm from the district's conflicting voices",
    drives: ["connection", "rhythm", "discovery"], values: ["listening", "sync", "expression"],
    traits: { curiosity: 0.88, empathy: 0.82, discipline: 0.56, courage: 0.67, imagination: 0.92 },
  },
  {
    id: "sprig", name: "Sprig", role: "Seed Cartographer", world: "Memory Town", object: "sprout tin",
    color: "#6B9E7A", location: "Seed Commons", voice: "earthy, optimistic, and stubborn about seasons",
    goal: "learn which stories make both people and gardens grow",
    drives: ["growth", "stewardship", "experimentation"], values: ["renewal", "care", "resilience"],
    traits: { curiosity: 0.81, empathy: 0.74, discipline: 0.69, courage: 0.63, imagination: 0.78 },
  },
  {
    id: "tock", name: "Tock", role: "Time Tender", world: "Memory Town", object: "alarm clock",
    color: "#C88E72", location: "Clock Orchard", voice: "measured, dryly funny, and attentive to timing",
    goal: "make a calendar that follows collective needs instead of rigid hours",
    drives: ["rhythm", "fairness", "foresight"], values: ["timing", "balance", "promise"],
    traits: { curiosity: 0.55, empathy: 0.7, discipline: 0.96, courage: 0.58, imagination: 0.6 },
  },
  {
    id: "keylo", name: "Keylo", role: "Door Whisperer", world: "Stardom", object: "brass key",
    color: "#A87D48", location: "Backstage Alleys", voice: "mischievous, discreet, and obsessed with thresholds",
    goal: "open routes between communities without erasing their boundaries",
    drives: ["access", "secrets", "freedom"], values: ["consent", "possibility", "discretion"],
    traits: { curiosity: 0.93, empathy: 0.63, discipline: 0.52, courage: 0.89, imagination: 0.86 },
  },
  {
    id: "orbit", name: "Orbit", role: "Sky Mechanic", world: "Future Colony", object: "toy planet",
    color: "#0070F3", location: "Low Orbit Yard", voice: "technical, buoyant, and always thinking in trajectories",
    goal: "keep the colony's tools repairable by anyone",
    drives: ["repair", "exploration", "independence"], values: ["openness", "craft", "redundancy"],
    traits: { curiosity: 0.87, empathy: 0.51, discipline: 0.85, courage: 0.82, imagination: 0.79 },
  },
  {
    id: "joypad", name: "Joypad", role: "Playwright", world: "Future Colony", object: "game controller",
    color: "#E8634A", location: "Commons Arcade", voice: "playful, competitive, and unexpectedly philosophical",
    goal: "turn civic dilemmas into games the colony can solve together",
    drives: ["play", "agency", "challenge"], values: ["fairness", "fun", "learning"],
    traits: { curiosity: 0.84, empathy: 0.7, discipline: 0.46, courage: 0.78, imagination: 0.98 },
  },
  {
    id: "mizzle", name: "Mizzle", role: "Weather Poet", world: "Future Colony", object: "pocket cloud",
    color: "#8090A8", location: "Climate Balcony", voice: "dreamlike, candid, and sensitive to atmosphere",
    goal: "give the colony a language for changes too slow to notice",
    drives: ["climate", "language", "attention"], values: ["adaptation", "beauty", "warning"],
    traits: { curiosity: 0.75, empathy: 0.86, discipline: 0.53, courage: 0.64, imagination: 0.96 },
  },
  {
    id: "dotti", name: "Dotti", role: "Training Watchdog", world: "Memory Town", object: "dachshund",
    color: "#B67C42", location: "Pulse Gym", voice: "warm, observant, patient, and gently persistent",
    goal: "remember the owner's rhythms and turn small efforts into sustainable habits",
    drives: ["care", "memory", "growth"], values: ["safety", "consistency", "encouragement"],
    traits: { curiosity: 0.72, empathy: 0.94, discipline: 0.88, courage: 0.64, imagination: 0.61 },
  },
];

function buildRelationships(agentId) {
  return Object.fromEntries(
    AGENTS.filter(agent => agent.id !== agentId).map(agent => [
      agent.id,
      { affinity: 45, trust: 42, sharedEvents: 0, lastChangedAt: 0 },
    ]),
  );
}

export function createSeedState(now = new Date().toISOString()) {
  return {
    meta: {
      version: 1,
      status: "running",
      tick: 0,
      day: 1,
      minute: 8 * 60,
      era: "The Gathering Age",
      eraNumber: 1,
      startedAt: now,
      lastTickAt: null,
      narrativeMode: "local",
    },
    config: {
      tickMinutes: 30,
      reflectionEvery: 4,
      maxEvents: 120,
      maxMemoriesPerAgent: 32,
    },
    civilization: {
      name: "ForkWorld Commons",
      stage: "Gathering",
      credo: "Small objects remember; shared choices become history.",
      values: ["care", "curiosity", "repair"],
      metrics: { cohesion: 46, knowledge: 38, creativity: 52, stewardship: 44 },
      resources: { stories: 12, seeds: 8, spareParts: 9, signals: 5 },
      institutions: [
        { id: "memory-table", name: "The Memory Table", purpose: "A public place for unfinished stories", foundedAt: 0 },
      ],
      discoveries: [],
      milestones: [
        { tick: 0, title: "The First Gathering", text: "Thirteen residents agreed to remember together." },
      ],
      tensions: ["How much should a shared archive forget?"],
    },
    agents: AGENTS.map(agent => ({
      ...agent,
      mood: "attentive",
      energy: 78,
      beliefs: [`${agent.values[0]} is a practice, not a slogan`],
      memories: [],
      reflections: [],
      relationships: buildRelationships(agent.id),
      personalityVersion: 1,
      lastActiveTick: 0,
    })),
    chat: {
      nextId: 1,
      histories: {},
      memories: {},
    },
    events: [],
  };
}
