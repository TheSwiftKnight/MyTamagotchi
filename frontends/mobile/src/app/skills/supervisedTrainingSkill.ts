import type { PlazaSkill } from "../plazaSkills";

export type SupervisedTrainingExercise =
  | "squats"
  | "lunges"
  | "pushups"
  | "dumbbell_shoulder_press"
  | "dumbbell_rows"
  | "bicep_curls"
  | "situps"
  | "tricep_extensions"
  | "lateral_shoulder_raises"
  | "jumping_jacks";

export type SupervisedTrainingFrame = {
  sessionId: string;
  exercise: SupervisedTrainingExercise;
  imageData: string;
};

export type SupervisedTrainingFeedback = {
  phase: string;
  repCount: number;
  statusColor: "idle" | "good" | "warn" | "alert";
  primaryCue: string;
  secondaryCue?: string;
  speakText?: string;
  errors: { code: string; cue: string; severity: number }[];
};

export type SupervisedTrainingSummary = {
  exercise: SupervisedTrainingExercise;
  repCount: number;
  durationSeconds: number;
  topMistakes: { code: string; label: string; count: number }[];
  nextFocus: string;
};

export interface SupervisedTrainingProvider {
  health(): Promise<boolean>;
  start(exercise: SupervisedTrainingExercise): Promise<{ sessionId: string }>;
  analyze(frame: SupervisedTrainingFrame): Promise<SupervisedTrainingFeedback>;
  stop(sessionId: string): Promise<SupervisedTrainingSummary>;
}

export const SUPERVISED_TRAINING_EXERCISES: {
  id: SupervisedTrainingExercise;
  label: string;
}[] = [
  { id: "squats", label: "深蹲" },
  { id: "lunges", label: "弓步蹲" },
  { id: "pushups", label: "俯卧撑" },
  { id: "dumbbell_shoulder_press", label: "哑铃肩推" },
  { id: "dumbbell_rows", label: "哑铃划船" },
  { id: "bicep_curls", label: "二头弯举" },
  { id: "situps", label: "仰卧起坐" },
  { id: "tricep_extensions", label: "肱三头屈伸" },
  { id: "lateral_shoulder_raises", label: "侧平举" },
  { id: "jumping_jacks", label: "开合跳" },
];

const DEFAULT_TRAINING_API = import.meta.env.VITE_SUPERVISED_TRAINING_API_URL || "http://127.0.0.1:4000";

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || `监督训练服务返回 ${response.status}`);
  }
  return payload as T;
}

export function createSupervisedTrainingProvider(baseUrl = DEFAULT_TRAINING_API): SupervisedTrainingProvider {
  const api = baseUrl.replace(/\/$/, "");
  return {
    async health() {
      try {
        const response = await fetch(`${api}/`, { method: "GET" });
        return response.ok;
      } catch {
        return false;
      }
    },

    async start(exercise) {
      const payload = await readJson<{ session_id: string }>(await fetch(`${api}/api/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercise, mode: "manual" }),
      }));
      return { sessionId: payload.session_id };
    },

    async analyze(frame) {
      const payload = await readJson<{
        phase: string;
        rep_count: number;
        status_color: SupervisedTrainingFeedback["statusColor"];
        primary_cue: string;
        secondary_cue?: string;
        speak_text?: string;
        errors?: SupervisedTrainingFeedback["errors"];
      }>(await fetch(`${api}/api/session/frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: frame.sessionId,
          exercise: frame.exercise,
          image_data: frame.imageData,
          mode: "manual",
        }),
      }));
      return {
        phase: payload.phase,
        repCount: payload.rep_count,
        statusColor: payload.status_color,
        primaryCue: payload.primary_cue,
        secondaryCue: payload.secondary_cue,
        speakText: payload.speak_text,
        errors: payload.errors || [],
      };
    },

    async stop(sessionId) {
      const payload = await readJson<{ summary: {
        exercise: SupervisedTrainingExercise;
        rep_count: number;
        duration_seconds: number;
        top_mistakes: SupervisedTrainingSummary["topMistakes"];
        next_focus: string;
      } }>(await fetch(`${api}/api/session/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      }));
      return {
        exercise: payload.summary.exercise,
        repCount: payload.summary.rep_count,
        durationSeconds: payload.summary.duration_seconds,
        topMistakes: payload.summary.top_mistakes,
        nextFocus: payload.summary.next_focus,
      };
    },
  };
}

export const SUPERVISED_TRAINING_CONTRACT = {
  source: "lianlema-portable",
  mode: "hybrid-realtime",
  stages: ["选择动作", "提取姿态关键点", "判断阶段与次数", "限频纠错", "生成训练总结"],
  supportedExercises: [
    "深蹲",
    "弓步蹲",
    "俯卧撑",
    "哑铃肩推",
    "哑铃划船",
    "二头弯举",
    "仰卧起坐",
    "肱三头屈伸",
    "侧平举",
    "开合跳",
  ],
  guarantees: [
    "动作分、次数与阶段由确定性规则或姿态模型产生",
    "同一错误连续出现后才播报，并遵守提示冷却时间",
    "摄像头在手机端采集，压缩帧经 HTTPS 临时推理且不落盘",
  ],
} as const;

export const SUPERVISED_TRAINING_SKILL: PlazaSkill = {
  id: "supervised-training",
  name: "监督训练",
  englishName: "Supervised Training",
  category: "训练",
  summary: "把实时姿态识别、动作计数、限频纠错与训练总结封装成可独立加载的监督训练能力。",
  color: "#B67C42",
  version: "1.0",
  source: "Dotti · 练了吗",
  capabilities: ["实时姿态监督", "动作次数与阶段追踪", "限频语音纠错", "训练总结"],
  featured: true,
  manual: {
    overview: "监督训练 Skill 从“练了吗”的实时教练中抽取，只保留稳定的训练会话契约。手机浏览器负责摄像头采集，Dotti 通过线上姿态引擎持续判断阶段、次数与最需要修正的问题；摄像头界面、模型实现和文字教练都可以独立替换。",
    setup: [
      "选择训练动作，把设备放在能够完整看到身体与活动范围的位置。",
      "先以无负重或低强度完成一次校准，确认光线、站位与关键关节可见。",
      "开始会话后按固定频率分析画面；结束时仅保存次数、错误摘要与下一次重点。",
    ],
    checks: [
      { title: "阶段与次数", detail: "持续判断 ready、lowering、bottom、rising 等动作阶段，只在完整动作闭环后累计次数。" },
      { title: "姿态偏差", detail: "根据当前动作检查身体排列、关节方向、动作幅度与稳定性，并按严重度排序。" },
      { title: "提示节流", detail: "同一错误连续出现后才触发语音，播报后进入冷却，避免训练中被重复打断。" },
      { title: "组末总结", detail: "结束时汇总动作次数、训练时长、最常见问题与下一组优先改进项。" },
    ],
    feedback: [
      "每次只指出当前最重要的一个问题，再给出一句可以立即执行的修正。",
      "动作改善后降低提示频率，继续安静记录阶段、次数与稳定度。",
      "无法识别完整人体时先提示调整机位，不对动作质量作武断判断。",
    ],
    safety: [
      "出现疼痛、眩晕、呼吸困难或失去平衡时立即停止训练。",
      "Skill 只提供动作观察与训练陪伴，不替代医生、康复师或真人教练诊断。",
      "负重、康复期或高风险动作应由专业人士确认后再进行。",
    ],
    privacy: "手机会把压缩画面帧经 HTTPS 临时发送给姿态引擎，服务端只在内存中完成关键点推理、不保存原始视频；进入 Agent 记忆的只有动作摘要、次数和用户主动确认的训练记录。",
  },
};
