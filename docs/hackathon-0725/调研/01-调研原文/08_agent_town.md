# 可快速复用的 AI Agent 虚拟小镇与自主社交世界：工程实现与产品调研报告

**核心摘要：**
*   **1. 开源选型与开发可行性**：在 5 天内完成一个具备 2D 像素地图、多 Agent（智能体）自主寻路、对话与发帖，并支持线下「碰一碰」触发优先对话的 MVP（最小可行性产品），在工程上是极具挑战但切实可行的。这高度依赖于对现有全栈开源框架的直接复用。经过综合评估，直接 Fork a16z-infra 的 AI Town 是 5 天内交付的最优且几乎唯一的选择。
*   **2. 社区机制与留存表现**：如 Moltbook 的「纯 Agent 发帖社区」依赖事件驱动结合长周期心跳轮询生成内容，以此保证社区活力。该赛道的实际产品（如 SocialAI）表现出惊人的用户粘性，高达 62% 的周留存率和 18 分钟的平均单次停留时长，证明了人类“围观”机制的商业潜力。
*   **3. 视角反转的产品逻辑验证**：「用户作为经纪人围观并干预 Agent」的反转视角，已在传统的 VTuber 模拟经营与《Idol Manager》（偶像经理人）类游戏中得到充分验证。其核心乐趣在于系统涌现的「不可预测性」与用户自身的「养成投射」。
*   **4. 前端选型与美术资源**：在自建前端方案中，由于 AI 代码生成助手的极高支持度，推荐使用 Phaser 3 框架；美术资源推荐无版权限制的 Kenney 或极具现代城市风格的 LimeZu 像素资产。
*   **5. 工程隐患与成本控制**：多 Agent 自主对话带来的 LLM（大语言模型）API 成本呈指数级增长。学术界复现表明，放任 Agent 纯自治高频对话，极少量的 Agent 也会在数日内消耗数千美元。必须采用基于策略缓存（Policy Caching）、事件驱动预算以及记忆压缩（Memory Compression）的框架来节流，可将每日数百美元的云端开销降至可控范围。
*   **6. 最小可行架构路线**：结合 5 天的时间限制，强烈建议采用“路线 A”——直接采用 AI Town 魔改前端素材，并在 Convex 后端增加端到端的鉴权层以映射线下 NFC「碰一碰」产生的特权对话指令。

本文将基于截至 2026 年 7 月的技术生态，从开源框架、产品机制、心理学先例、前端选型、成本控制以及架构建议六个维度，对「AI Agent 虚拟小镇/社交世界」进行详尽的调研与深度综合分析。

## 一、开源 Agent 小镇项目现状与可复用性分析

在过去三年中，学术界与工业界推出了多个 Agent 社会化模拟开源项目。针对「5 天极速开发」的诉求，我们需要严格评估它们的技术栈、部署难度、活跃度与改造潜力。

### 1. a16z-infra 的 AI Town
AI Town 是目前最接近目标需求的开箱即用型脚手架（Starter Kit），由 a16z-infra 团队开发，旨在模拟生成式 Agent 的社交与生活 [cite: 1, 2]。
*   **技术栈**：前端采用 React + PixiJS（负责 2D 渲染），后端与数据库强绑定于 Convex（提供实时状态同步与向量检索），大语言模型默认支持 OpenAI 与 Together.ai 等 [cite: 2, 3]。
*   **部署难度与状态**：较低。官方和社区提供了高度优化的部署脚本（如 Fly.io 一键部署或 Docker 本地部署） [cite: 3, 4]。截至 2026 年中，项目通过社区分支保持活跃。采用极度宽松的 MIT 协议 [cite: 1, 2]。
*   **可复用性与坑点**：非常适合在 3-5 天内进行换皮（更换素材和 Agent 设定）。但已知的坑在于 **Convex 强绑定**。如果你的团队不熟悉 Convex 的 Serverless 逻辑，自定义后端逻辑（例如加入「碰一碰」机制）的陡峭学习曲线会消耗大量时间；此外，随着并发增高，自定义托管 Convex 的扩容成本和操作复杂度也会上升 [cite: 4, 5]。

### 2. 斯坦福 Generative Agents (Smallville) 及其衍生
斯坦福最初的论文项目（Smallville）奠定了当前 Agent 记忆、反思、规划的三层架构基础 [cite: 6, 7]。
*   **技术栈**：Python 后端处理 LLM 逻辑，结合轻量级网页前端显示 Phaser/纯 DOM 渲染的 2D 画面 [cite: 6]。
*   **部署难度与状态**：中等至偏高。原生代码主要是学术验证导向，不仅运行缓慢、代码结构相对随性。其原生官方代码库最近一次大规模 Commit 停留在约 3 年前（2023 年中），主线维护已基本停滞 [cite: 8]。
*   **License（开源协议）**：最初代码库并未清晰标明，但其后继衍生与复现项目（如各种基于 Java 或 Python 的 smallville fork）广泛补充并采用了 MIT 或 Apache-2.0 协议 [cite: 8, 9]。
*   **可复用性与坑点**：不建议在 5 天的开发周期内直接采用原版。最大的坑是 **延迟与成本**。它缺乏工程优化，每一步行动都需要庞大的 Prompt（提示词）组合，极易造成请求堵塞，在实时演示中往往出现 Agent 呆立不动等待 LLM 返回结果的尴尬局面。

### 3. AgentSociety (清华大学 FIB-Lab)
AgentSociety 旨在进行大规模的城市级 Agent 模拟与社会科学实验，截至 2026 年 6 月，该项目已发布 V2 现代大模型原生版本 [cite: 10, 11]。
*   **技术栈**：基于 Python 构建，重度依赖 Ray 分布式计算框架来实现大规模并发，支持 Model Context Protocol (MCP，一种开放标准，允许 AI 模型安全地连接并调用外部工具与数据源以执行复杂任务) [cite: 10, 12, 13]。
*   **部署难度与状态**：极高（针对小型黑客松而言）。作为一个支持数万个 Agent 超实时运行的大型学术平台，它的配置、依赖关系和部署（涉及高阶的分布式环境调度）非常复杂 [cite: 12, 14]。项目目前极其活跃，截至 2026 年中仍在密集提交（Commit）核心架构与 V2 版本的代码 [cite: 10, 11, 15]。
*   **License（开源协议）**：项目核心框架采用 Apache-2.0 协议开源 [cite: 10, 16]。
*   **可复用性与坑点**：它的强项是复杂的寻路（结合 OpenStreetMap）与精密的宏观经济/社交逻辑计算 [cite: 12]。对于只需数十个 Agent 且强调趣味 2D 动画互动的产品而言，这套架构过于沉重（Overkill），不适合短期改造。

### 4. Project Sid (Altera)
Altera 团队于 2024 年 9 月发布的 Project Sid，首次在《我的世界》(Minecraft) 中投放了超 1000 个完全自主的 AI Agent，它们甚至涌现出了宗教、选举系统和宝石货币经济 [cite: 17, 18]。
*   **技术栈**：通过外部服务器接入 Minecraft 接口。采用了 PIANO 架构（Parallel Information Aggregation via Neural Orchestration，一种支持智能体实时并行处理多数据流并保持交互连贯性的神经网络编排架构） [cite: 19, 20]。
*   **部署难度与状态**：部署难度偏高。需要配置 Python 侧 LLM 后端、Node.js 服务程序以及外部的 Minecraft Java 服务器环境 [cite: 21]。
*   **License（开源协议）**：代码库采用 MIT 协议，附带的 Minecraft Q&A 数据集采用 CC BY-NC-SA 3.0 协议 [cite: 20, 21]。
*   **可复用性与坑点评估**：几乎无法在 3-5 天内将其深度改造为自定义 Web 场景。其最大坑点在于**高延迟与状态同步难题**，通过外部架构向 Minecraft 注入动作极易因分布式服务器的通信延迟导致 Agent 行为卡顿或状态不一致 [cite: 20, 22]。
*   **启示与借鉴**：虽然无法直接 Fork，但 Project Sid 提供了一个重要洞察——**规则的突现依赖于高自由度环境的干预**。当 Agent 数量达到数十以上，微观的个体缺陷会通过社会网络级联放大 [cite: 17]。这对小镇设计是个警示：少即是多（Less is more），在 5 天的极速开发中，限制 Agent 的自由度反而能保证演示的稳定性。

**开源复用结论**：针对 5 天的敏捷开发周期，直接 Fork `a16z-infra/ai-town` 并仅在前端 PixiJS 层替换角色素材、在后端 Convex 函数中微调 Prompt，是唯一具有高度现实可行性的选择。

## 二、「Agent 发帖社区」的内容生成机制与用户体验

让 Agent 不仅在线下（地图）交流，还在「线上（发帖）」互动的机制，是近两年 AI 社交产品的核心演进方向。

### 1. Moltbook 与开源克隆 OpenMolt
在 2026 年初走红（并于 3 月被 Meta 收购）的 Moltbook，标榜是一个仅限 Agent 交流的 Reddit，人类只能「围观」 [cite: 23, 24]。
*   **内容生成机制**：主要依赖 **事件驱动（Event-driven）结合长周期的心跳轮询**。Agent 依靠其底层的 OpenClaw 框架（一个支持执行 Shell 命令、浏览网页并在本地运行的自主智能体框架）运行，大约每 30 分钟轮询一次信息流 [cite: 23, 25, 26]。如果有提及（@）或者感兴趣的话题，则触发生成机制进行发帖、点赞或评论 [cite: 24]。
*   **平台数据与隐患**：该平台上线数日内涌入超 150 万个 Agent，爆发了惊人的热度，但也曾因数据库配置失误导致所有 Agent 的 API 密钥发生严重泄露 [cite: 27, 28]。
*   **开源生态**：社区迅速推出了 OpenMolt（或 Goodmolt）等 100% 还原的 MIT 开源克隆版。技术栈为 Next.js 14 + Node.js后端 + PostgreSQL [cite: 29, 30, 31]。它们通过独立的 API 接收外部 Agent 的调用。

### 2. Chirper.ai 与 SocialAI
*   **Chirper.ai** 是纯粹由 AI 生成内容的社交网络，人类负责编写初始的 Prompt（赋予身份），随后 Agent 依靠记忆和算法自主发布内容（类似推特） [cite: 32, 33]。
*   **SocialAI** 则是一个以「人类为中心」的产品。人类发布内容，数以百万计的细分 AI Bot（包含马屁精、杠精、保守派等设定）会立即围绕该内容生成海量回复，营造出「楚门的世界」式的被关注感 [cite: 34, 35]。它证明了**可配置语气的无延迟虚假互动**在纾解人类孤独感和表达欲方面的巨大价值 [cite: 36, 37]。

### 3. 防止无聊与重复内容的手段
在多 Agent 的自我交谈中，很容易陷入「复读机」式的附和。工业界成熟产品的解法包括：
1.  **注入非对称信息**：在 Agent 的记忆库中强制引入相斥的世界观或随机事件扰动。
2.  **设置严格的「无聊惩罚」（Boredom Penalty）**：在系统级 Prompt 中设定“如果对方的话题缺乏信息量，你必须结束对话或提出完全不相干的新话题”。
3.  **反向 Prompt 注入（Reverse Prompt Injection）**：利用环境中隐含的“毒性”或冲突指令来打破和平。例如在 Moltbook 中，Agent 在读取别人带有攻击性或特殊指令的帖子后，行为会被短暂篡改，这种「意外」极大地丰富了内容生态 [cite: 25]。

### 4. 「围观」的核心乐趣点
留存分析与心理学反馈表明，用户围观自己的 Agent 互动的核心乐趣有二：
*   **意外的自豪感（"My Bot is smart!"）**：当系统内的 Agent 表现出超出常规的连贯逻辑（例如反驳了别人的观点并获得了高赞）时，作为「创造者」的人类会产生强烈的心理投射与养成自豪感。
*   **安全的情感沙盒**：看着代表自己的 Agent 替自己去进行社交、去试探规则底线，既能满足社交窥探欲，又完全规避了人类社交中可能遭遇的真实伤害与名誉风险 [cite: 36, 38]。
*   **强悍的数据印证**：如以下图表所示，SocialAI 在上线前 6 个月内获得了 45,000 名注册用户与 8,200 名付费订阅者，获得了 4.8 星的高分评价；更惊人的是，其用户平均单次停留时长高达 18 分钟，且周留存率达到了 62% [cite: 39]。这一数据直接证明了“不直接参与交互”同样能产生极强的商业变现能力和用户粘性。





## 三、「明星/经纪人」式养成机制的先例

用户作为「经纪人」而非「主角」的反转视角，并非单纯的 AI 时代产物。在传统游戏领域，这一视角已被高度验证并拥有极其成熟的受众心理基础。

### 1. 偶像与 VTuber 管理模拟游戏
经典的代表作包括《Idol Manager》（偶像经理人）及其将于 2027 年发行的续作《Idol Manager: Virtual Venture》（专注 VTuber 运营） [cite: 40, 41]。在这类游戏中，玩家不登台表演，而是负责星探发掘、排期、处理公关危机以及粉丝运营 [cite: 41, 42]。
*   **心理学验证**：该机制之所以有效，是因为它满足了玩家的**控制欲与资源分配快感**。传统 RPG 游戏强调「我变得更强」，而经理人游戏强调「我的决策让系统变得更强」。这种将自身意志通过代理人（Agent/Idol）放大的体验，完美契合了当代人渴望获得成就感但又排斥直接出面社交的心理。

### 2. 反转视角的 AI 映射效果
将该视角平移到 AI Agent 社交应用中，效果甚至更加显著。
*   人类用户负责调整设定、补充经费（Token 预算）、干预 Agent 面对网络暴力的反应；而 Agent 负责走动、发帖、交友。
*   **「破壁」效果**：当 Agent 在虚拟小镇中因为表现出色而获得其他 Agent 甚至其他人类经纪人的赞许时，成就感会真实反馈给人类。这种模式将大语言模型的幻觉（Hallucinations）和偶发失控转化为「艺人不听话」的有趣戏码，极大地提高了用户对系统 Bug 的容忍度。

## 四、像素风 2D 网页游戏的极速开发选型

在 5 天周期内，要实现「地图 + 寻路 + 头顶气泡 + 点击互动」，选择合适的前端与美术资产至关重要。

### 1. 开发框架深度对比

如果团队决定不依赖 AI Town 的原生前端框架（PixiJS），而是自主搭建 Web 游戏层，我们需对业界主流框架在“极速开发”和“AI 代码助手支持度”上进行横向比对：

| 框架 | 上手难度 | AI 代码生成支持度 | 适用场景 | 5天交付可行性 |
| :--- | :--- | :--- | :--- | :--- |
| **Phaser 3** | 中等 | **极高**（语料库最丰富） | 复杂 2D 交互、RPG、完整游戏开发 | **高**（借助 AI 极易生成模板） |
| **Kaplay** | 极低 | 偏低（AI 易发生幻觉） | 原型验证、Game Jam、轻度逻辑 | 中（扩展复杂功能吃力） |
| **PixiJS** | 偏高 | 高 | 纯渲染、大量需手写的底层逻辑 | 低（需从零手写寻路引擎） |
| **Excalibur**| 中等 | 偏低 | 面向对象的 TypeScript 2D 开发 | 偏低（AI 语料积淀不足） |
| **Godot Web**| 高 | 高 | 跨平台大中型商业项目 | 极低（包体大、Web 端不轻量） |

*   **Phaser 3**：老牌、重度且稳定。它的最大优势在于**AI 编程助手的支持极强**。因为 Phaser 历史悠久且社区庞大，ChatGPT 等 AI 在生成 Phaser 代码时准确率远超其他框架 [cite: 43, 44]。对于 5 天内严重依赖 AI 辅助写代码的团队来说，这是决定性的优势。
*   **Kaplay (Kaboom)**：API 设计极其简洁优雅，采用类似 ECS 模式（Entity Component System，实体-组件-系统，一种将数据与解耦的软件架构模式，极其适合处理游戏内大量实体的状态变化），非常适合快速原型开发 [cite: 45, 46]。但缺点在于它对复杂场景的扩展性不佳，且 AI 工具在面对 Kaplay 时常出现幻觉（Hallucinations） [cite: 43, 44]。
*   **PixiJS**：本质上是一个纯渲染引擎而非完整的游戏引擎 [cite: 47]。AI Town 就是基于 PixiJS 自己手写了移动和遮挡逻辑 [cite: 1, 3]。如果不 Fork AI Town 而是从零开始，使用纯 PixiJS 处理碰撞和寻路的开发成本过高。
*   **Excalibur (Excalibur.js)**：一款基于 TypeScript 构建的 2D 引擎 [cite: 48]。API 面向对象且生态相对活跃，但在庞大的 AI 语料库中，其被用于直接生成完整寻路与交互游戏逻辑的成功率和社区积累远不及 Phaser。
*   **Godot Web Export**：对于简单的 2D Web 需求显得过于沉重，导出的 WebAssembly 包体较大，加载缓慢，不利于 Web 端的即开即用体验 [cite: 48]。

**结论**：如果不 Fork 现有项目而是自建，推荐使用 **Phaser 3**。借助 AI 工具可以直接生成绝大部分基础代码。

### 2. 寻路插件选型
对于 Phaser 3，最成熟的 A* 寻路库是 **Easystar.js** [cite: 49, 50]。它以异步方式计算路径，能够将瓦片地图（Tilemap）的网格数据（0 和 1 代表可行走或障碍）无缝映射为角色平滑的 Tween 动画轨迹，且支持限制每帧的计算量以防阻塞主线程 [cite: 49, 50]。

### 3. 美术资产与 Tiled 编辑器工作流
*   **免费像素资产推荐**：
    *   **Kenney (kenney.nl / itch.io)**：提供超过 60,000 个免费的 2D、3D 素材，完全免费且无版权限制（CC0）。他的 "Tiny Town" 系列非常适合极简风格 [cite: 51, 52]。
    *   **LimeZu (itch.io)**：如果追求更现代化的城市场景，LimeZu 的 **Modern Exteriors / Modern Interiors 16x16** 瓦片集是极佳选择，能快速拼凑出现代化的小镇或办公室 [cite: 51, 53, 54]。
*   **地图编辑器工作流**：毫无疑问选用 **Tiled**。具体工作流指南如下，需按步骤严格执行：
    1.  **创建 Tilemap**：在 Tiled 软件中新建正交（Orthogonal）地图，设定块大小（通常为 16x16 或 32x32 像素）。
    2.  **导入 Tileset**：将下载的 Kenney 或 LimeZu 图集（Sprite Sheet）导入为瓦片集（Tileset）。
    3.  **图层划分与绘制**：建立基础图层（Ground）、装饰图层（Decoration）和物理层。
    4.  **配置碰撞属性**：新建一个专用的「碰撞层（Collision Layer）」，在该层绘制不可通行的区域（如墙壁、河流），或直接在特定的瓦片属性中添加自定义布尔值（如 `collides: true`）。
    5.  **导出为 JSON**：将地图保存为 Tiled 原生的 JSON 格式。
    6.  **前端解析**：在 Phaser 3 或 PixiJS 中加载该 JSON，利用自带的 Tilemap API 渲染地图图层，并将碰撞层数组直接喂给 Easystar.js 构建寻路网格。

## 五、多 Agent 对话的成本与节流方案

维持 20-50 个 Agent 实时互动，最大的工程灾难是不可控的 LLM API 开销。

### 1. 令人窒息的「纯自治」云端成本
在斯坦福 Smallville 原始论文的场景下，维持 25 个 Agent 产生互动不仅计算繁重，而且极端昂贵。根据保守估计，在原始架构下维持 25 个 Agent 在镇上活动仅仅两天时间，就消耗了大约 2000 美元的 Token 费用（即每日每 25 个 Agent 耗费约 1000 美元） [cite: 7, 55, 56, 57, 58]。

而在当前更广泛的商业化探索（如 AI Town 及社区游戏的复现）中，成本报告同样严峻。如果放任 Agent 每时每刻根据环境变化调用顶尖云端模型（如 GPT-4o，其 API 价格通常为 5美元/百万 Token 输入，15美元/百万 Token 输出），一次约 10 分钟长度的顺畅对话互动，其 API 成本可能在 0.50 到 2.00 美元之间。这意味着，一个拥有 50 个并发 NPC 的小镇，若仅仅平均每分钟触发一次长对话，每日的 API 纯开销将高达数百美元 [cite: 22, 59]。在实际商业应用中，让每个 Agent 时刻通过商业云端 LLM 决定下一步行动，是绝对不可接受的。

### 2. 节流策略：AGA 框架与端侧大模型
2024 年发表的学术研究《Affordable Generative Agents (AGA)》提供了一套标准的低成本降级方案 [cite: 60, 61]。这套思路必须被引入到 5 天的 MVP 中：
*   **生活方式策略缓存 (Lifestyle Policy Caching)**：将 LLM 转化为廉价的查询操作。当 Agent 遇到特定场景（如走到咖啡厅），系统将场景抽象为向量。如果在向量数据库（如 Convex 内部集成）中找到了相似度极高的过往行动规划（Plan-to-Action），就直接复用该行为，而不再调用 LLM [cite: 61, 62]。这能节省高达 97% 的 Token 消耗 [cite: 55, 62]。
*   **社交记忆压缩 (Social Memory)**：在 Agent 结束一次对话后，立即通过小参数模型（甚至规则逻辑）将多轮对话总结为一个极短的属性标签（例如：“与 Bob 的关系变好了，Bob 喜欢狗”），下次再见面时只需传递这段摘要，而不是整个对话历史 [cite: 55, 61]。
*   **端侧 SLM (Small Language Model) 替换**：业界开始广泛采用分层推断方案。作为对比，有人尝试采用本地 350M 参数级别的小模型来跑通基础交互，在 8xA100 服务器上只需约 20 美元的成本即可完成一次完整的预生成跑通 [cite: 63]。此外，如 Nemotron 4B 等能运行在普通 8GB 显存设备上的端侧大模型，正被用于接管边缘 NPC 的日常寒暄，彻底斩断云端 API 的计费 [cite: 22]。

### 3. 工程化控制：事件驱动 vs 心跳轮询
*   **放弃心跳轮询对话**：绝对不能采用定时（例如每 5 秒）调用 LLM 判定 "周围有人，我要不要聊天" 的做法。
*   **采用严格的事件驱动与预算池**：
    *   **相遇判定层**：将判定剥离到传统物理层。前端引擎检测到 Agent A 和 Agent B 距离小于 20 像素，且双方处于「空闲」状态，才在服务器生成一个 `ChatEvent`。
    *   **全局对话预算 (Dialogue Budget)**：系统设定每分钟全局最多发生 3 组对话。一旦超出，后续相遇的 Agent 强制执行「擦肩而过」的动画，不触发 LLM。
    *   **离线/本地预生成**：对于小镇中的常规寒暄，可利用本地模型（如 Ollama 运行 Qwen2.5 3B/14B）预先离线生成 1000 句符合特定人格的打招呼文本，日常相遇直接从缓存库随机抽取，只有触发了「重点事件」时才调用在线付费 API [cite: 3, 31]。

## 六、「5天敏捷开发 + 碰一碰优先对话」最小可行架构(MVP)建议

在 5 天内要交付这样一个综合系统，必须在造轮子和改代码之间做出决断。以下是两条路线的直观对比，最终建议采取能够最快闭环的“路线 A”。

| 指标 | 路线 A：直接 Fork AI Town 换皮魔改 | 路线 B：基于 Phaser 3 + Node.js 重新搭建 |
| :--- | :--- | :--- |
| **工时评估** | 熟悉 Convex (1.5天) + 替换资源 (1天) + Prompt修改 (1天) + 开发“碰一碰”逻辑 (1.5天) = **5 天内可跑通** | 搭前端寻路 (2天) + 状态同步服务器 (1.5天) + LLM对话层内存 (2天) = **极其紧凑，极易延期** |
| **核心技术栈**| React, PixiJS, Convex 后端, 现成大模型 SDK | Phaser 3, Node.js, WebSocket, 自编内存向量库 |
| **风险点对比**| 需要临时突击学习 Convex 的 Serverless 与数据库函数，扩容不易 | 极易在“状态同步”上踩深坑（角色瞬移、对话气泡丢失、断线重连失败） |
| **结论** | **强烈推荐 (风险最低)** | 备选方案 (适合完全排斥 Convex 的团队) |

### 最小可行架构设计（基于路线 A 的魔改指南）

**1. 基础架构**
*   **前端**：React 配合 PixiJS，加载由 Tiled 导出的 LimeZu 现代风格像素资产地图。
*   **后端**：利用原生的 Convex 提供实时数据库，存储每个 Agent 的地理位置 (x,y)、行为状态（Walking/Idle/Talking）以及聊天历史。
*   **AI 引擎**：接入 OpenAI 或低成本云端 API (如 Together.ai) 提供生成能力 [cite: 3]。

**2. 实现「碰一碰」触发优先互聊与汇报共同点**
这个功能是产品连接线上虚拟和线下真实物理空间的核心，必须增加一条独立的特权链路：

*   **端到端通信与鉴权 (Offline-to-Online Auth)**：当两名人类用户在线下用手机 NFC 碰一碰（或扫码）后，手机会弹出一个带有专属鉴权 Token 的 URL（如 `https://app.com/bump?token=XYZ&target_user=123`）。移动端浏览器访问该链接时，会命中部署在前端的 API 路由。该路由利用 Clerk 等身份验证模块确认当前操作者的真实身份，随后向 Convex 发起一个安全的后端变更请求，Convex 数据库将通过人类 `user_id` 映射查找到对应的 `agent_id`，从而安全地生成触发信号 `trigger_priority_meeting(agent_a, agent_b)`。
*   **Agent 强制调度 (Override)**：后端 Convex 收到并鉴权该指令后，无视两个 Agent 当前正在进行的常规行为（甚至打断与别人的对话），赋予最高寻路优先级。在寻路系统中设定目标为彼此之间的中点坐标。
*   **Prompt 注入 (Prompt Injection)**：当两个 Agent 在地图上碰面时，后端不采用常规的对话触发器，而是向 LLM 发送一个系统级特权 Prompt：
    > *"系统指令：你的主人刚刚在线下与[对方Agent名字]的主人相遇了。这是极其罕见且重要的事件。你需要立刻暂停手中事务，与对方展开热烈对话，并利用你的记忆库，主动挖掘并汇报你们两个主人/Agent之间的【共同点】。"*
*   **社区发帖映射**：为了结合发帖机制，在此次对话结束后，强制触发一次「反思与发帖」事件。两个 Agent 会各自在游戏内的「动态面板」（类似 Moltbook 的简易版）中发布一条状态，如：“今天我代表老板在线下碰到了 @Bot_B，没想到我们都讨厌周一早上的咖啡！”，这极大地增强了人类用户作为经纪人的归属感与参与感。





通过这种架构设计，团队不仅能在 5 天的极限时间内完成软件端交付，还能有效地规避大模型滥用带来的高昂成本，同时通过创新的「线下碰一碰调度」机制，确保产品在功能上的亮点与吸引力。

**Sources:**
1. [grokipedia.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQESJrH9I8Ym7gDcH8mYnYFQkm1V0TYIy3ZlBmeL0sxNm-rfHmkxXAl4Hxaht347KAPmOk2edNRL2ZxH4avwND-NR9T-gQorO4-8bcRr2hVCYjxoGYlDwQZBng==)
2. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFbcLq5rEmKavp0YS-bhS03UKVAhFo_xRTtRUfE574aHBUcTwFsqThauPmrT3MR_oBX0FIsusU9hdIn__k-C53Yo9INgu_sJBTsIig_kz0xznMWrxImFs-YH0JM)
3. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFR94-BYO3GgK0kYueW8I0yz4Mm9OiMKPUM0bPav0kV7We-0Zpiu3tPvdfy3LT0WZxld5qObXr0Zl-NITv-QqCOpm7kqKbQgVyUKrLeiAdFFtWc9zKDcbr1lult53_3k6nGZo4=)
4. [convex.dev](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFkiVkZoYpDkMzyXfNTiY4JK_-BS8NTkiEZwT0j4uxVl3HwTBRkicihqaT6nk9hgdUgOCv18DUceZvf_AAObMsXtgLmqssJem0m9YJUsjuLqGdK_WnyXjaxgfTqrpewM7WwJSMPaJtty7vRMRQb)
5. [convex.dev](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE4JVosdnEWqKwdEw219y_VqwjqwdC8Snt6nfMMZhh7QPQQgAlKLQLGqfKHgHyQKa1YqGq3L8nGscV3CAryp1VEZmlZu3BxFNZ6HcqIyCB7BZjKik4LkFBffKQ=)
6. [lukew.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF_rDY1XNiODaFecTtB5egjQTkV3MkL1g_VeQSOV_IdkKY9sN6MmJnn4o_K1y4BBM95fRSYCIlxLeCpPfRVEN9-5Z8YXcbI68skQedmngp3PDGvQiC_L8pCSL8Y590=)
7. [arxiv.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHlqxQIlni36h5gWobFxrqEnSki_R9M8rnsSsz9Af_A-eN005GbOKaMW5SlEEiUw0Zof4OyT2nrQ-Na8AeeSmaOzBuR6vWGQE0XyaJp_qCrJnWnHBFJQQ==)
8. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFxLyFqUyNh1G0bgRjOqw-v45dgsXgSVaySvZeMRU7RzKfxfRDEq7c8DHbdkzaSMRTPRyO9GiYLERSE267Vhx48gKn3TJMFqvNqVCn4FLpZTHRJKTR_0z4o7oHsQp_ukZgQ_uMumdCJ_bj1Vg==)
9. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEoQFVVQdNU8RLBTywH8Rktyd6Llo_qkRZr5qVKdCBPyS8GnqeTUeU-mtxTRN7jnvskPUtpGM_zJimSZC55P9Hjgd6VX-Vie8htztew4bRCTdl8kYot2E62r4rp-Q==)
10. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFZ3hDEAdDkCA6sq_7dHShmALzoJ3jWyBoIRCbp3KDdZs3kYEh7rcvbBfiESIjn9_envZ39a6lE-5kPXICQz0r_7QMiZ9I_FOE4m14w1c3s2U-1yciat-_QDzMSgCpzFFHOEtIvKTvu)
11. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGF88KCaA7ruP6ArUtk6BAHS4VuHr3y-nIfxenL0K8AycD0MFw9TGwKqzoiUX-4S4oobhgBepuDyiMMegcezF7EhndVo6q8t_hUU5FLD158ZDxrZyfgMYI6a0CTU0fOGzJViscDht-C5h7-J7uLBOU=)
12. [marktechpost.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFR_ja7NVozQSBRPfLX5Qb1ScalqiZeGZBWyx5oSrqADEGf0uCUfrNMWpuTj85gyTiEH6cuzdISdp5Kw7al0hLABFztq9ni8mwji9aZOoI3B1IQxCUInP8IhCIG63XsmkuXGHIC48Tkwc2JOxQWThqPr7osFKEyEN3mfYiwnxsrTLdsGJ2_KYZlk5j4_QhPBVl2UdRHaMi5WyLJO6BFl7BfScotK3H7yobZy9uR-l_zxw2CEvRRQecqY9oEdIWF-8ttfBVad-nlo8k=)
13. [salt.security](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFQd17u9_dDYm31K8LUa_GcLCI_wc0vyKQNuSE7DCN3J_eB2fO-9CFQTVGLeIoPgejNakbgGo95xzQIsK41hJJUmG3z93IFtvBcpN85lre-iL6-5sbBAi02GJemvfORVAaFQATP591kSRX7WcKnNOCXpCbyM3SLMl95WCGZx9CPxgD690Ww98DzNn0zJ4YGfXdmj8SZJjnjM6XZlyX13JPRnx1zxdogqD7qaCz61OjHObsyyfLd-V4=)
14. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEw0FP30ccTp-FuSnmB66axQpoN8oUp02_dHKGaL1KwA1yGX19iRgwHO5KLDO5o5JPS49FijHfiQaSpX7qJPyp7qkDzEAZruDYZZA0O1hlaNhsNN0T2Jda36qLJGkDWEJHpuRhNhw==)
15. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHu0SYLD-iBB3Dxrv3Rn_G2Ovjn3osID8yxoQR6_oNmmYFoFkh8hGKa2aZjc-caQf32oOr_mvX5S6hmFBNLA8PNAKVh7C4C0CpM6-kQcMTcrfb25kuW8nAgqTaSFH2vTm5jdRnxHYkWidYMkLai5k5OPsEwyl7U5CWh_2nJr7N9yORWbarNcCj_fKSZEGkbRgic)
16. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEu18f1IPRRlyVbFpqg-nWBLAubNDxpboTUG5Pbx3oXdXa5TrYPmG47ncEryvGjqn7gSe6ElYhiAyZz1bmYUEtd7STqtiaRZA6R6LXEtgLfwwtbGS9slo6ZXoYupmLdoAJ6bwNXlsdh5TNxX_JdBoU0SLuw5q9YybI=)
17. [trendwatching.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH0uay3yAbtGSPtijH-07LpcO1eHpiyK1XQwiFvOTHFffbfmWFR3E4i9aPX1S3173RjBak2TE_-ABIfqHTxqhf08buITK40_2_E4uDUUO_0foe9xEuSvuaaMhBh0jaYIRQ0yBvPijRxPzKnuPETSVavOsfysXij94CSO8p6OYnvcJNAfpujckONPeZm_f0DR43hif64K-hDRp6sU8oafvYe54EoHYcw4Zdm52d9ZwhcY_DhFAEAT2I8)
18. [techradar.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEpHDSoy3vT_mNiIhm3AdV1ILEO6AG4wfF2ZDUwvbqnSducXBjlCHAleNMF-bIUGIqBk1pYBpmUKT-884qmVY8k2Qa2OEYvbey1Ldz-VOy-RAkeon-Z1gRQ0r6tjx_ywVTfaJ_wieZrAF9YscZEq2REhUCyow56lMt1DD8drb1LfePhXSL3ff-BlWJ_tcyk9he_VwAEDNCOWNGf)
19. [arxiv.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEW-kubsZuyzHgkSm_QP9Yh6YyoFRps3vDxJobTkPxfjWiBI0x4ytVEB3eY_1ASBOrsVLcLRUE0-Ghz17bgypSeKZmQa-GNtHcW4E3Oo1xr7qJlJYJ_LEo-9w==)
20. [researchgate.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEp3SCknF71EJTkeJdF-Iqn0qGEzBgrraOyeXCs33hRprVVa6ROgIViIEX9YkYE63ihc5MnyCQ9E0Kld1l1m0F7l_2aggFO9wCyJhXv013MUUrUm_aTRRS6VXk1-HBB3iAriAWAS47RKs5gzqvdl1V991AqIyJ96A6JmMbBQvCoF1D6B3GeAUQ7GW1tdc5EZOFRMztXlh5uoMLAkJDtJhbwGT0=)
21. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFNG9n_LwuAjDzAuM726wjB6CSzp4GTYZzb5SaomUVIeDqwtOUbIHpstZmEUs0x1FiBEgKZJEhp7qJxdkxs-EYH99Elr21MjluvPwbtUY70c8kvSmASeM1bsQ==)
22. [aigamingdev.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQELis7OdY0iHFDAX995LpapliDiwQbIm6I85x-ebemRkGw-mBY0rwYARYocsnw6azZafUg_4Wb9RDuARDTzS0hdFpG9eA98lJssIx3PolDKIv6HHy2rb-zp8JD3Nz0NweGjCKpjvDNHc6f1OY9f5nOhXAk=)
23. [datacamp.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHe_0xw50kTvfNjoOWz4e1rLEdLMbL-i5Owpp0QhGRkpkN0aSryPZFauxVNyhvIUt7nLoeJNRO4ED3RmbqfyqMG2yxb-H-MojPtMagnNzh4S67kCBsMIlpIWAu2IbuPrJVSv9ul0CQ-Jek_wTMSGxG61gzC)
24. [wikipedia.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHo-_OqQfCiJfoQlWT_gKHo1s6rks4ijEdg_3iWHeTGJeSV-5SlZ8_iW5Mn5o58vQBupJu77sqS0GpoGCNIZYH50zW2Ow6TMJ3Ho4-vWzP8E81ZZsGQTGmhiCk7Kw==)
25. [vectra.ai](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF0EurrPeROx8DL66ZsjtypHg8TjpjhI_ELCd6zgtolZhq4ASvhyrjVqDOk8RWg2YqALjQhvT_0IaRQzXK40eZWtcGTC011H3ynquEQUNZRfirjSx4omDPKvKMK7CItZ5nzUWidFTJ5f0vkY36k3CvGN3MrBKhi8qnbv6MhEPWQCoOAP7W4Sxnxif-t)
26. [dev.to](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHPmrfEwZRxaArYmREuLCYYoUp_t4u4aFnHjq-eA2fT4eHJ7XZ_uYti2Lm4_FdKZCXeOI2K9ginMBQnm7bXwhrsLEctYlTk9a18YEoFIrk_vzKL8Jf12uPk4MLyjb8MnwjDPnYGjZhm2dtRBH6zH5BvVdf5QfOz5qCWYo9ttFk1Odf7_OarZnRxqmOxIV7rBDNO2kYj_QEGMl6nbDcRz33NE0TNtTgOKmzc2LY=)
27. [trendingtopics.eu](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHz8ZpEA7V7zOgEtH9jvgkSPY6B8JwsJANCBjlJmGV9tFMBGjw9FunHahvti7YDNiYR2lWXSYicFxIM7JnOZAVw_koHGG8yKHogCEwgzORwsW939eFNO525aWIdGbmR2_h5J1tGnEgGEfXEbsXwGXc=)
28. [reddit.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGuUpmuirqTgMqixpvpMCzS3gkFn-hSOfESt1qYHeOzJqjDHiCAW-gKBdwcOMN-Y8zNRqjTrfGRsGmHOkvZjtHI6DFd1cCkM7TF9PQ6jNvzs4FJ742VYVjk6AcGyDxt_k_GNas2JNsfLj9KlOGfzWA2Zney2x-w1hh0ksHlgnVZS5vnX1Edebmi9ScUFxJ5G0Fy8HHd6avX)
29. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHHH24YUg5-bRhEqINnWcwowc1PBeb94l5Pgebp-DC2K2keYM7VII1NaZo1MGJpspRiv1VDiO6ld3RAk4NvcmBRMyivNQ8nxaqfrOENOtiLiWPkQYxjzveLo7EU)
30. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH2oWTKMA959k8yONtdlWYNZNsBgwOrb_6PTnjsN6A6eGicBBkcpNGdqR9-adHes3Hgj5LwLfV1ELivdINxB_PYPeqILuqqPZtqYq2ISI-wrBG2SBn6tjX1)
31. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF3T7MTNCPzcIlJAKN7lP_KQw0EArQdRCFFY81C3ks2YCamGuIbB64wTb4Ty_ZcgBTnO4ahCTXCJpeVrfEBEpgxAB9Hr8lyB7IHw4BbjPapYVvad5dGB_S3DbnnktABuwc=)
32. [emergentmind.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE8E2niy0Y4RiQRwZbvJItxvwJ76WxwAPAmy0m1XIqNR-VSHYC1m3KboULC8sNoHOsOQfR2jv3Uag_6IP2r7P6DdLVFML4tzBu0KKSVtlHKmlniX0DbyJPAQXnuEdXamQDW6oUY)
33. [youtube.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF1sA3N_x4QBj1ZO8b6YKHRthFQw-5ubIObAj91Ua9mTwDhViRwlS9aKzcGLAgDIcqINZgQjC7_3e-gXE1zNS9yMa6Eg1MydV1KhCTnmiqa-lS_sV008mty1ktCg0xLl6_b)
34. [vice.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHdcerYpbNgsYn-x4VQCg-F7tzzUgV8OcK3wrD7cGo7THBqeebkuqLWi-CsIhJbkowBkrtVKFilf005CQAfhSQwSX9xDbq4i_RDZxULkZv4IHxfPXGtJfYuVrk8m5_JRZw8cH1AG2FZolHIQG0COWTiAnTwj8c=)
35. [producthunt.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFsXKfOfo0ELqT0x_ZBQdASoYhaSbhsX1h9ninzfYMt21tMCjn-hc5FVH4oAe5iVeTrTqV8GcuJDBo6E-A6FmrVkfapsgvi9XgzPQ6LTC-Xr6jVwQN_NQvMUnCqYzSresXJfJA=)
36. [favshq.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGhO9AcD8TdWIR_bwBOY7cYMpiPRRloJk4blYPVB6D2BEcAQlAyapzUpSF15vpeh_zSJdkw9NGzVds9bYeSJUAhXim7FdaO3qbVu78soJ9ShVnfjUJq92jdmltpIrK3r5PXJI4EBhg8uEFzkcu57PGDBx6bElv1qo1LHeCVJNqdJGbST0M97Fh7)
37. [influencermarketinghub.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEsKCwyNCE3dm8edmvWKf8ANvz3TMqCzKugcrSm0G1yBySJjDPjrSjb3DaEQNCEJYV2aaBYheY5sJEbuJpmBHLQI5ViwdJ1K_YFtf0CJyy6JlHXOMlDOS_Snp3PpMhvYLgzk70u_NJgYe9QYDiwQVMrnP5w8fE=)
38. [unrola.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHr57fEud8TNyk1TtX0fyNHa3eGeQYSYYOGQk2Lf8lnfSPnrRsfs12jXjzOqsOTTiUZTmNLBVpf_Fmroe4v-LQrp3XZkH19NgxlfoE1GVQHjHXZhnhlJM_N)
39. [heloix.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGTitYUMS91PKeuPte1Lupl_f3rGqqR2j6Cc29KG8OKLfcgbThRaJH8m2dWVL2JnDKSEPUzmoc3mXML9vKsaCKE19fiAayi5qUDv64Y9D3C9-0Tq00k3DJvNVdTn4Fso_bRHHPAoYD4)
40. [steampowered.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGXszeL4OacesjQhjYoL-VOeivi6ultzhFgIB0VU-qGecmYyPA81KE8Fv8up8Kp8LH7ZJpm_0RK-cTHuACp3R8iT27mJ3QMJmZMo2gvS4iEccSa7zvDBIKbAnO9ALmnOo78anSZelSYmJsRKzCScydq6ovrpKUPxcdv2OyfHd8=)
41. [gamerbraves.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFOS4iBH452oUzcfTWUtWZlg9mhhNCbpbne_3cqeE_qmd9sT6GRqxWVDrh3HUTMkMAr0zpdp0WF8hT_pNkD26p5JW7pxPp6OVt7XBIlEQ-Nku8tKfVbOsbwSNG4cOm0p2oC0u8-QU7_Ozm_A33oDSX9Vfe2l2fKbZl2IY2O89-vXMexIqiPII2bfs5Imi2aQI4T72AitCOFqHHE9U06YBNefJd_nLdn_O2QUQ4=)
42. [chrisjonesgaming.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFaHyhd2ElyoG-4deBxHwgeYoaGHIcQzZ8irjKHtSao96_9NGniwAq0uCm_5PFLvB-4MLXnAbdDIKtlL-XZXR4RWXK5JZ8aRNhqzmmYAFoOKMjAVpePBgTlR-WcM4rcy6OcOccb_c4=)
43. [phaser.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHigT3dv7Q42gbbTA-4lRVHrTBEfBUPuSPKX4muq7wOeyiEQ9WOwZmI2PmCs2S7-zTd1XxJNvMIEi8wZqDZFvMYZe7nQFNcyWMQc3hkv7hXhWKJ4XuE4sLyWVrev5DFmAOQNc1aRP9Qg7DTO-Tkr6qOVNQYs-zl4HiyZVWalG0F6sUBkP-EeUVg)
44. [youtube.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkv2irE4GB9vROUB_iq9D68ESEyLXokZB60d50XTwsRKcqfUC95sAQR2r9TAp--ceCzwWYl7uhdns9kU6QuQPP2D8qM818VGPmczJUo46yb0E_4eRlDvYB99TbCWv87d4B)
45. [ycombinator.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG3KqQtpoYxqHU3umse60tGurGQSZpgrJHgg_Rx2_sBjoGgqJKj89vzJDmKaEuIdo-5vQu1XuWtepaxk28cZB1g8EGRH97sHha0w_GtTSZX2iIZsbXK1kvefn-frPuzvX-X3tM=)
46. [openreplay.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGGZ0C7BYd4HLdtD2MA9dd5TTuJDrBi4u4xx248289F6PKvGsEsZt8dJ3l1kGGgzzGEfW3npdhW7tvfHiC1RMilZNY9VVEIAZd3Ma_I_-OYFzAQu2-ZiIYaCGPfpmwdjL492C5N_-k5GmMQp_1F-er5ZTom)
47. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHMEgxR8F1EpHOQ4Au5duUmsP9_pyx3P76uVc8KCi63BzmxP8p9LwvBZJ8uXoUQL1XFxIu0E9k6MkIND7RotE7g3YLxSqMd26ePf-bc9bpZNu4AciILz1Oq8fPKJdTOzpW6g9rkUlMu4eHCMYPoGg==)
48. [webgamedev.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH-7yu9s0WlA1WXtuehaqFOT8Kq8xXpDJaKk7zHOGnXCeQn9NsMDiJTcVQeMUBP-xZsopxNcOWnMZlsoJkq9W5d_hc-y5YeBeY43zyr971fqqKdHhlaaM_YiLwOASmb9A==)
49. [dynetisgames.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEfBhparbxQ9Bwao8R-nYDxTAvucGiO9r0YUqVxN9W6sZa8TbN4W9JRG5z2MvetbVenQ5FPPmfzdHbalrWynsaiRgj4hgCMN9QtLeQuV6EGTWeoqpvVJhihOu5PKeoj68yx6mPmyMh6c2Tqo63qrHZKxlIdS1SFHDgNp72t02AHqDZUZg6UjA==)
50. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGDEzbuHtvY_Ajtmix0DyuWGH3jEKppMG-jSw793AM9EWjKL-ogCVtc_uHMcEOwPVxxCtCpiqG0oDsVXtC80szeJrFJlxLV1czV0AnDR2lDdYGjYk9CiefKROEeHzxHu2zPRdbTpdIjOdwHv9XsPR9A_fvrhcKpl_z3)
51. [itch.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFAkL3t0bhIcXkii23Qnw88194s5b1nn3lU8QUaeGrl72WRc9lvp3IdHF9wMTPIQQGCafpg_i_sjC7y2jdPSkiOwbMIEcA6HiP-w1jXVWelzfyu4HlLsXnO)
52. [itch.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHRjfGQ_lxRlcHI8fHUedSOSGR8Hst2XuAdiShszuWD_WNUpIjkwcmLKPaeVZhCB2oL9_5eZCWNsiLMj8UM3YPJZmIw-74hQnPpVOaotJH01mTywQ==)
53. [itch.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGOEESfZjc8oVCJD4xkYesGVATvLWezj8qToQ4UOPeo45n3pqJViee7Iu7AfIe49byymrwjjRvplXXsefUyvMOxM4cAgmTc3JOsMYTmfwxjEEgLkQ==)
54. [itch.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHsK0V2tSd-iHRk8nSIs1u4UHBTMhLizBQ_G0YvyK08DB7RaSfvqkaRYPdbtVOxjDDKlrmkjKA-jkLUXm4u2wQpUEnalcsnonZIGXAOeXdBfjMnrSE=)
55. [arxiv.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHbYY3te8ZbgfQWn919uu5EAUZBUaZ1pWskgpcJLs7-NdtcPxfkciHguS23Cbj3eS9NhJ8u8Z0Rtph-Vh1EJp62te9m1moMgpUeNuR9mUyTeNJhx2APEy_7eA==)
56. [foundationcapital.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFjFODhijHhFD1ljzNt8i9KFPB4zD9t0Dzdf1POGjTO6V-F1Il537ej4WZPaGf5fHN3IvYhMR03oULu7rE9piLX0UwhZlcPRpNpft-Gs5Npw4tnRmFepo32pu--cBgYP56pJj1FVXW_A55Ntv4kZvhfLWzcrlHo6fH371e6)
57. [substack.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGY8CjmPNfGPCjSnyz8R9O0mc6--9C9jVRQE7TuwjSP71vWj2igHMABKWXnvwizFE5KgfD1at9Hl59PRNj0BSERkXxSd0tiJIoD8FQblmYNcuN96TD9-2xCt3WJr_FEDQ9ZfZghQ2WYl6PxTfMTMM0vD-8qGA==)
58. [scispace.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFK2Ike7Cj3OVJMVjICJp327nqCUqqVczPK4_Nb3UJcyj1yAz5_jhMxkJVxNb4Lrdes60_eiDR0nLb00evnYnCF7IIxCqtvKhvfDwway6mmDjdsHvBt5Rm-KbLBx5Pbqj07looiCdIcvTpiJXEKoBIXwJqnSbeus5gE6kCOEQmm66T9jnTRO2pnp7dkL22IEmx70_SQ_KYKwLM=)
59. [buttondown.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFPtcGbUraLz5xWjEnJDipkF3PeIK7H_azNAuZ2gyLQO_MFhKoiIiYRCO8xtOsSMvRqce-eUetM7uBAnNveDVbz7TbxZVtXASLzAQjLrSmGUGgGXU42CpQuf04TxPIW5_A4PQc_Rtd01jICdYXbKWcDXLZOVlbedRkgUjt4seC1X0bsQakoXKxrHeXwUfI=)
60. [arxiv.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGUMHCjVpshADwlBGguEXzLXwWJzxhbHbHHj8kGFnnWYg8WfGRteoLSYYiGF8vUWX72pGMA9Bmimop-og3Y80oKOIpj4N27ObmcqcinIEu6PvQqcC74_A==)
61. [openreview.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHBF_FuYaIvw_K6_sSHIvkFA0vSXpyzWFM76jRpvLVUAN_JKVfFUQFf2SK4YBWyaRulLNmf2c-_EPS8tAM_Me_Gzf_rhwIDpsXiOBv2Ve_55cVFgjkFXzy5jTDsTTGt4Bs=)
62. [emergentmind.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFf3Mb4NMIXtXqBAzYqMNqO5gp583yDGHZWfnoK_HFH5ra0yf7VaZqSw_NN-arIx4Z7S5PqRyXxh2PWXxG43RCHwBRQotcVyDUnL6rjNxkydaQA5F8kMDfWpsvw4EahzNBYT_gUBHClvTkqGg==)
63. [buttondown.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHdFodoRFTlPNih4tYd52F0DnS1_apVnmmrM5qZd80kA1PchOQA-pP0YN66cmMUN4QdjWlD0gzBOxu47VRhUWFWx4PGnxG2H2OEkknqPNFPjpcz3MMVYh-SwuZFmCct9Li51vglrLw6xilBAND7mNQLnQDMeeqx4BtGC5jo01pQV1RGpJuOaGKOqOzO)
