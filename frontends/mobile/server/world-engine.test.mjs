import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { WorldEngine } from "./world-engine.mjs";

async function makeEngine() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "forkworld-engine-"));
  let moment = 0;
  const engine = new WorldEngine({
    storagePath: path.join(directory, "state.json"),
    now: () => `2026-07-23T00:00:${String(moment++).padStart(2, "0")}.000Z`,
  });
  await engine.init();
  return { engine, storagePath: path.join(directory, "state.json") };
}

test("a turn creates history, memories, and relationship movement", async () => {
  const { engine, storagePath } = await makeEngine();
  const state = await engine.step();
  assert.equal(state.meta.tick, 1);
  assert.equal(state.events.length, 1);
  assert.ok(state.events[0].dialogue.length >= 2);
  assert.equal(state.events[0].phase.complexity, 1);
  assert.ok(state.events[0].action.label.includes("眼前需要"));
  assert.equal(state.events[0].stances.length, state.events[0].participants.length);
  assert.ok(state.events[0].stances.some(stance => stance.kind === "propose"));
  assert.ok(state.events[0].stances.some(stance => stance.kind === "question" || stance.kind === "support"));
  for (const participantId of state.events[0].participants) {
    const agent = state.agents.find(item => item.id === participantId);
    assert.equal(agent.memories.length, 1);
  }
  const saved = JSON.parse(await readFile(storagePath, "utf8"));
  assert.equal(saved.meta.tick, 1);
});

test("reflection changes personality and civilization enters a new era", async () => {
  const { engine } = await makeEngine();
  const state = await engine.step(8);
  assert.equal(state.meta.era, "The Weaving Age");
  assert.ok(state.agents.some(agent => agent.personalityVersion > 1));
  assert.ok(state.civilization.metrics.knowledge > 38);
  assert.ok(state.civilization.institutions.some(item => item.id === "listening-post"));
  assert.equal(state.events.at(-1).phase.complexity, 2);
  assert.ok(state.events.at(-1).action.label.includes("习俗"));
});

test("pause, run, reset, and visitor chat remain explicit API operations", async () => {
  const { engine } = await makeEngine();
  await engine.setStatus("paused");
  assert.equal(engine.state.meta.status, "paused");
  const exchange = await engine.chatWithAgent("miko", "请记住我喜欢清晨散步。");
  assert.equal(exchange.memoryAccepted, true);
  assert.equal(engine.getAgentConversation("miko").messages.length, 2);
  assert.equal(engine.getAgentConversation("miko").memories[0].text, "请记住我喜欢清晨散步。");
  await engine.reset();
  assert.equal(engine.state.meta.tick, 0);
  assert.equal(engine.state.meta.status, "running");
});

test("chat history, relevant memory recall, and deletion persist", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "forkworld-chat-"));
  const storagePath = path.join(directory, "state.json");
  let recalled = [];
  const engine = new WorldEngine({
    storagePath,
    agentChatGenerator: async context => {
      recalled = context.memories;
      return recalled.length ? `我记得：${recalled[0].text}` : "我会认真听。";
    },
  });
  await engine.init();
  assert.ok(engine.state.agents.some(agent => agent.id === "dotti"));

  await engine.chatWithAgent("dotti", "我喜欢周末去公园跑步。");
  const followUp = await engine.chatWithAgent("dotti", "你还记得我喜欢在哪里跑步吗？", { remember: false });
  assert.ok(followUp.response.includes("公园跑步"));
  assert.equal(recalled[0].text, "我喜欢周末去公园跑步。");

  const reloaded = new WorldEngine({ storagePath });
  await reloaded.init();
  const conversation = reloaded.getAgentConversation("dotti");
  assert.equal(conversation.messages.length, 4);
  assert.equal(conversation.memories.length, 1);
  assert.equal(await reloaded.deleteLongTermMemory("dotti", conversation.memories[0].id), true);
  assert.equal(reloaded.getAgentConversation("dotti").memories.length, 0);
});

test("an injected LLM narrative stays behind the same world interface", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "forkworld-llm-"));
  const engine = new WorldEngine({
    storagePath: path.join(directory, "state.json"),
    narrativeGenerator: async ({ agents }) => ({
      title: "由模型写下的习俗",
      summary: "居民们比较两种履行承诺的方法。",
      dialogue: agents.map(agent => ({ agentId: agent.id, text: `${agent.name}提出先做一次可以撤回的尝试。` })),
      consequence: "这次尝试会进入下一轮共同讨论。",
      moodByAgent: Object.fromEntries(agents.map(agent => [agent.id, "curious"])),
      optionalNewBelief: "可以撤回的选择，依然可以有意义。",
    }),
  });
  await engine.init();
  const state = await engine.step();
  assert.equal(state.meta.narrativeMode, "llm");
  assert.equal(state.events[0].title, "由模型写下的习俗");
  assert.ok(state.events[0].dialogue.every(line => line.text.includes("可以撤回")));
});
