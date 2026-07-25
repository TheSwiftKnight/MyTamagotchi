/* ForkWorld 设计令牌 —— 来源: Develop ForkWorld Visual Direction (纸面手绘风)
 * 全部 UI/overlay 层统一用这里的 token。 */
window.FW = window.FW || {};

FW.T = {
  paper: "#F5F0E8",      // 纸面底色
  card: "#FAF6EF",       // 卡片底色
  ink: "#1C1911",        // 墨线
  inkSoft: "rgba(28,25,17,0.55)",
  inkFaint: "rgba(28,25,17,0.12)",
  a1: "#E8634A",         // everyday 主色·暖橙
  a2: "#6B9E7A",         // 草绿
  a3: "#4A7FA5",         // 湖蓝
  gold: "#D4A800",
  road: "#C8C2B4",
  grass: "#B8D4A0",
  water: "#9BBFCF",
  // 手写感字体栈（离线可用：中文走楷体，拉丁走 Caveat 若已装）
  fontHand: '"Caveat","Kaiti SC","STKaiti","KaiTi",cursive',
  fontMono: '"VT323","Press Start 2P","Menlo","PingFang SC",monospace',
  fontBody: '-apple-system,"PingFang SC","Hiragino Sans GB",sans-serif',
};

/* 世界点缀色轮换（ForkWorld everyday/stardom/future DNA 抽取） */
FW.WORLD_ACCENTS = ["#E8634A", "#4A7FA5", "#6B9E7A", "#D4A800", "#C890C0", "#0070F3"];

/* 30 种地标类型 → emoji 图标（与 contracts/world.schema.json 枚举一一对应） */
FW.LANDMARK_ICON = {
  lab: "🧪", shelf: "📚", statue: "🗿", garden: "🌷", observatory: "🔭",
  workshop: "🔧", cafe: "☕", library: "📖", lighthouse: "🗼", stage: "🎤",
  gym: "🏋️", kitchen: "🍳", garage: "🚗", greenhouse: "🪴", dock: "⚓",
  campfire: "🔥", treehouse: "🌳", museum: "🏛️", arcade: "🕹️", studio: "🎨",
  radio_tower: "📡", shrine: "⛩️", market: "🛒", theater: "🎭", clocktower: "🕰️",
  windmill: "🌬️", pond: "🌙", mountain: "⛰️", tunnel: "🚇", archive: "🗄️",
};
FW.landmarkIcon = t => FW.LANDMARK_ICON[t] || "📍";
