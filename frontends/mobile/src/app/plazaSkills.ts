import { SUPERVISED_TRAINING_SKILL } from "./skills/supervisedTrainingSkill";

export type PlazaSkill = {
  id: string;
  name: string;
  englishName: string;
  category: string;
  summary: string;
  color: string;
  version: string;
  source: string;
  capabilities: string[];
  featured?: boolean;
  manual?: {
    overview: string;
    setup: string[];
    checks: { title: string; detail: string }[];
    feedback: string[];
    safety: string[];
    privacy: string;
  };
};

export type AgentSkillBinding = {
  agentId: string;
  skillId: string;
  state: "mastered" | "learning";
  proficiency: number;
};

export const PLAZA_SKILLS: PlazaSkill[] = [
  SUPERVISED_TRAINING_SKILL,
  {
    id: "route-mapping",
    name: "路线测绘",
    englishName: "Route Mapping",
    category: "空间",
    summary: "把真实路线拆成地标、顺序与可以复用的行动步骤。",
    color: "#579447",
    version: "1.4",
    source: "Atlas · Stardom",
    capabilities: ["识别地标", "生成安全路线", "共享行动路径"],
  },
  {
    id: "emotional-care",
    name: "情绪陪伴",
    englishName: "Emotional Care",
    category: "关系",
    summary: "先确认对方的情绪，再决定回应、记录或安静陪伴。",
    color: "#E8634A",
    version: "2.1",
    source: "Miko · Memory Town",
    capabilities: ["情绪确认", "陪伴式回应", "边界判断"],
  },
  {
    id: "visual-archive",
    name: "视觉归档",
    englishName: "Visual Archive",
    category: "记忆",
    summary: "将被允许公开的画面整理为带来源与时间的可检索记忆。",
    color: "#4A7FA5",
    version: "1.8",
    source: "Shutter · Memory Town",
    capabilities: ["画面索引", "来源标注", "隐私过滤"],
  },
  {
    id: "boundary-sense",
    name: "边界感知",
    englishName: "Boundary Sense",
    category: "安全",
    summary: "识别空间与关系中的公开边界，避免越权观察与分享。",
    color: "#696858",
    version: "1.2",
    source: "Ink · Future Colony",
    capabilities: ["权限识别", "公开范围判断", "敏感信息拦截"],
  },
  {
    id: "fitness-companion",
    name: "健身陪伴",
    englishName: "Fitness Companion",
    category: "健康",
    summary: "通过镜头观察动作关键点，判断姿势、节奏与动作幅度，并给予实时提示。",
    color: "#6D6884",
    version: "1.2",
    source: "Noct · Future Colony",
    capabilities: ["动作姿势判断", "训练节奏提醒", "次数与组数记录"],
    manual: {
      overview: "健身陪伴会在用户同意后调用摄像头，只分析身体关键点与动作节奏。它会比较当前姿势和动作模板，在不打断训练的前提下给出简短、可以立即执行的调整建议。",
      setup: [
        "将设备放在能看到全身的位置，镜头与训练区域保持平行。",
        "选择训练动作、目标组数和反馈频率；先完成一次无负重校准。",
        "确认周围没有障碍物，并给手臂与腿部保留完整活动空间。",
      ],
      checks: [
        { title: "身体排列", detail: "观察头、肩、髋、膝与脚踝的相对位置，判断是否出现明显偏移或塌陷。" },
        { title: "关节方向", detail: "在深蹲、弓步等动作中检查膝盖与脚尖方向，以及关节是否进入不稳定角度。" },
        { title: "动作幅度", detail: "根据用户选择的动作模板检查起点、终点与活动范围，不强迫追求超过个人能力的幅度。" },
        { title: "速度与节奏", detail: "识别过快、停顿不足或左右节奏不一致，并用短提示帮助用户重新控制动作。" },
      ],
      feedback: [
        "先用一句话指出当前最重要的问题，例如“膝盖方向稍向内”。",
        "再给出一个可执行修正，例如“脚尖与膝盖保持同向，再慢一点下蹲”。",
        "连续两次动作改善后减少提示，只记录组数、节奏与稳定度。",
      ],
      safety: [
        "出现疼痛、眩晕、呼吸困难或失去平衡时立即停止训练。",
        "Skill 只提供动作观察与陪伴，不替代医生、康复师或专业教练诊断。",
        "负重、康复期或高风险动作应由真人专业人士确认后再进行。",
      ],
      privacy: "手机压缩帧经 HTTPS 临时发送给姿态引擎，服务端只在内存中分析且不保存原始画面；进入记忆的只有动作摘要、组数和用户主动确认的训练记录。",
    },
  },
  {
    id: "shared-chronicle",
    name: "共同编年史",
    englishName: "Shared Chronicle",
    category: "文明",
    summary: "把不同智能体的决定、分歧与结果编织成可修订的共同历史。",
    color: "#8A543B",
    version: "2.0",
    source: "Ansel · Pentiment",
    capabilities: ["多方叙事", "事件溯源", "版本修订"],
  },
];

export const PLAZA_AGENT_SKILL_BINDINGS: AgentSkillBinding[] = [
  { agentId: "dotti", skillId: "supervised-training", state: "mastered", proficiency: 98 },
  { agentId: "miko", skillId: "emotional-care", state: "mastered", proficiency: 92 },
  { agentId: "miko", skillId: "route-mapping", state: "learning", proficiency: 68 },
  { agentId: "shutter", skillId: "visual-archive", state: "mastered", proficiency: 95 },
  { agentId: "shutter", skillId: "boundary-sense", state: "learning", proficiency: 42 },
  { agentId: "atlas", skillId: "route-mapping", state: "mastered", proficiency: 96 },
  { agentId: "atlas", skillId: "shared-chronicle", state: "learning", proficiency: 54 },
  { agentId: "ink", skillId: "boundary-sense", state: "mastered", proficiency: 94 },
  { agentId: "ink", skillId: "visual-archive", state: "learning", proficiency: 76 },
  { agentId: "noct", skillId: "fitness-companion", state: "mastered", proficiency: 90 },
  { agentId: "noct", skillId: "emotional-care", state: "learning", proficiency: 31 },
  { agentId: "ansel", skillId: "shared-chronicle", state: "mastered", proficiency: 93 },
  { agentId: "ansel", skillId: "route-mapping", state: "learning", proficiency: 47 },
];

export const MY_AGENT_SKILL_LOADOUTS: Record<string, string[]> = {
  dotti: ["supervised-training"],
  miko: ["emotional-care"],
  shutter: ["visual-archive"],
  noct: ["fitness-companion"],
};

export function getPlazaSkill(skillId: string) {
  return PLAZA_SKILLS.find(skill => skill.id === skillId);
}

export function getAgentSkillBindings(agentId: string) {
  return PLAZA_AGENT_SKILL_BINDINGS.filter(binding => binding.agentId === agentId);
}
