> agent: deep-research-pro-preview-12-2025 · interaction: v1_ChdBS0pnYXRmcEJlSEtxdHNQemEyQy1RcxIXQUtKZ2F0ZnBCZUhLcXRzUHphMkMtUXM

# Deep Research 调研报告：从非结构化数据（URL/PDF）快速构建用户个人画像的模块设计

**执行摘要与核心结论 (Key Points)**
*   **画像 Schema 设计建议**：业界研究指出，传统的扁平化标签（Flat Persona）不足以支撑连贯的角色扮演。建议采用类似于 CharacterLLM 和 RoleLLM 的“叙事模式（Narrative Schema）”结合“场景切面（Scene Facets）”的结构，最小可用版本（v1）应包含：身份事实、兴趣与价值观、以及控制角色扮演的边界与行为信号。
*   **非结构化解析 Pipeline**：对于 30 秒内的极速抓取，强烈推荐使用 Jina Reader API（基于 ReaderLM-v2），它能有效剔除 HTML 杂音并直接输出对大语言模型（LLM）友好的 Markdown 格式。
*   **防幻觉机制**：事实核查可以通过双阶段抽取和基于 NLI（自然语言推理）的轻量级 Provenance 模型来实现，同时在产品体验上引入低摩擦的 Human-in-the-loop（如生成后展示三个关键标签供用户一键微调）。
*   **冷启动与存储**：黑客松场景下（100 人规模，数千次对话），**不需要**引入 GraphRAG。基于 SQLite 搭配 JSON 字段的传统关系型数据库结合向量检索（Naive RAG）已完全足够且高效。渐进式 Profiling 技术可以在后期交互中逐步丰满用户画像，解决初期数据稀疏的冷启动问题。
*   **合规风险**：在微信生态内，需警惕 AI 自动生成内容被风控，且抓取第三方 URL 必须遵循 `robots.txt` 并提示用户仅提供自身拥有授权的链接。

**研究范畴与局限性声明**
本报告聚焦于非结构化数据向结构化用户数字分身（Digital Twin/Persona）转化的技术与产品设计路径。尽管所引用的学术文献和业界方案具备前沿性，但在 4 人 × 4 天的黑客松（AdventureX）极限开发约束下，部分复杂的图谱构建或多智能体博弈架构将被简化为可落地的 MVP（最小可行性产品）方案。报告提供的数据抓取稳定性或受限于具体网页的反爬策略。

---

## 1. 个人画像 Schema 设计

在设计「世界互访」项目中的用户个人画像（Persona）Schema 时，我们需要兼顾三个下游消费者：虚拟世界生成（需要静态事实与标签）、使者 Agent 角色扮演（需要性格、语言风格与记忆）、以及灵魂契合度计算（需要可量化的价值观与兴趣度量）。

### 1.1 业界与学术界画像范式分析

**业界数字分身与扮演产品（Character.AI / Replika 等）**
在当前的虚拟陪伴与角色扮演平台中，Character.AI 是行业的标杆之一。Character.AI 的角色定义通常采用 JSON 格式进行配置，以确保 LLM 能够高效读取和理解 [cite: 1, 2]。其典型的 Schema 通常分为第一人称格式或第三人称的分类格式，包含：性别、年龄、外貌（身高、发色等）、性格特征（外向、活泼、机智）、喜好（阅读、游戏）与厌恶（拥挤、噪音）、以及特殊才能 [cite: 2]。在 2026 年的最新标准中，一个“完整”的 AI 角色需要包含身份核心（Name + Positioning）、打招呼的场景引擎触发词、语音音频层、视觉生成以及长期记忆 [cite: 3]。为了防止角色在多轮对话中崩溃，业界提出了 CARE 框架（Context, Attitude, Response Style, and Examples），强调通过具体例子来规范响应风格 [cite: 3]。

**学术界方法（Generative Agents 与角色扮演 LLM）**
斯坦福大学的《Generative Agents》为智能体的记忆与画像提出了“记忆流（Memory Stream）”的概念。记忆流是一个综合数据库，使用自然语言记录了智能体的所有经验（观察、反思、计划）[cite: 4, 5]。通过“检索（Retrieval）”机制（结合时间近因性、重要性和相关性），系统从记忆流中提取信息并生成高层次的反思（Reflection），从而驱动行为 [cite: 4, 6]。这种架构有效地解决了扁平化标签带来的行为僵化问题。

更进一步，最近的针对大型语言模型角色扮演（MDRP, Memory-Driven Role-Playing）的研究，如 `CharacterLLM` 和 `RoleLLM`，指出了纯扁平化特征列表（Flat Trait Lists）的缺陷：它们会导致 LLM 在长对话中产生“风格平均化（Style Averaging）”和“局部人设崩塌（Out-of-Character Drift）” [cite: 7]。
为了解决这一问题，研究者提出了**叙事模式（Narrative Schema）**。该 Schema 将画像信息分为层次化的可查询结构：
1.  **全局摘要（Global Summary）**：角色的核心背景与总体定位。
2.  **核心特质（Core Traits）**：稳定不变的语义锚点。
3.  **场景切面（Scene Facets）**：高度依赖上下文的表达式。每一个切面通过“线索键（Cue Keys，如当前处境、触发词）”绑定到“表现信号（Enactment Signals，如社会角色、情感状态、思维模式）”和“边界锚点（Boundary Anchors，如时间范围、知识盲区）” [cite: 7, 8]。

RoleLLM 框架还强调了基于明确角色设定的输出控制（Secure access control），这为我们项目中讨论的“来访可见范围”和“使者边界”提供了理论支撑 [cite: 9]。

### 1.2 黑客松推荐的最小可用 Schema v1

针对“世界互访”黑客松项目的争论（分级体系、角色存储等），本报告建议摒弃复杂的网状结构，采用基于层次化 JSON 描述的 **Persona Schema v1**。该 Schema 在保证极简（能在 30 秒内由 LLM 从抓取文本中抽取完成）的同时，具备下游消费所需的强结构。

**最小可用 Schema 设计原则**：
*   **解耦化**：将“用户本人数据（Star）”与“使者 Agent（Envoy）设定”合并在同一个大 JSON 下，但分为静态属性区和动态行为区。
*   **标签化与叙事化结合**：静态属性使用数组（用于匹配），行为属性使用自然语言描述（用于 Prompt）。

以下为推荐的 Schema v1 核心维度（具体字段表见附录 A）：
1.  **Identity_Facts (身份事实)**：姓名/昵称、职业/身份、主要技能。*（用于世界地标的生成，例如职业为程序员可生成“硅基矿脉”）*
2.  **Interests_and_Values (兴趣与价值观)**：包含 3-5 个核心兴趣点标签，以及 1-2 句核心价值观描述。*（用于灵魂契合度匹配）*
3.  **Envoy_Settings (使者行为控制 - Scene Facets 的简化版)**：
    *   `Tone_and_Style`：说话语气（如：幽默、自嘲、严肃）。
    *   `Knowledge_Boundary`：知道什么（基于抓取内容的摘要）。
    *   `Privacy_Redlines`：不知道/不该说什么（拒绝回答的领域）。
4.  **Memory_Stream (记忆流)**：初始化为空数组，用于后续存储生成的游记和访问历史 [cite: 4, 6]。

---

## 2. 从非结构化来源提炼画像的 Pipeline

要求用户只需输入一个或多个 URL 或 PDF，系统在 30 秒内生成画像。这一环节的最大挑战在于**降噪**（去除 HTML 杂乱标签、广告）与**多源融合**。

### 2.1 抓取与清洗：Jina Reader 与 PDF 解析对比

**Jina Reader 的应用**
对于网页 URL，业界目前最成熟、轻量且开发者友好的方案是 **Jina Reader API**。Jina Reader (`r.jina.ai`) 的核心逻辑是将网页视作浏览器进行真实渲染，提取完全解析后的文档内容，绕过了复杂的 CSS/HTML 结构，并直接输出干净、对 LLM 极其友好的 Markdown 文本 [cite: 10]。
*   **技术优势**：传统爬虫会获取大量无意义的脚本、导航栏和广告，这会严重消耗 LLM 的 Token 并导致提取失焦。Jina Reader 解决了这一问题，近期推出的 ReaderLM-v2 (1.5B 参数) 专为 HTML-to-Markdown 优化，能够处理高达 256K tokens 的长上下文，且准确率极高 [cite: 11, 12]。
*   **使用方式**：直接在目标 URL 前拼接 `https://r.jina.ai/` 即可获取纯文本，极大降低了黑客松的开发门槛 [cite: 10, 13]。对于含有动态加载内容的单页应用，可以通过传入 CSS 选择器（如 `wait_for`）进行针对性等待 [cite: 11]。

**PDF 解析工具**
如果用户上传的是 PDF 格式的简历或作品集，简单的文字提取（如 `PyPDF2`）经常会遭遇排版错乱。Jina Reader 同样支持处理 PDF 文件并返回 Markdown [cite: 13, 14]。但在需要更高精度的情况下，推荐使用开源的成熟流水线（如 LLM-Based Extraction Pipeline 架构，使用 Hoover 进行数据清洗，或 UIMA 进行语义分块） [cite: 15]。但在 4 天黑客松内，直接通过 Jina API 统一处理所有格式是成本收益最高的选择。

### 2.2 多来源融合、去重与来源溯源 (Provenance)

当用户输入多个 URL（如 GitHub + 个人博客）时，Pipeline 需要进行以下步骤：
1.  **并行抓取**：利用异步并发对多 URL 进行提取。
2.  **融合与去重**：传统的 NLP 抽取（如命名实体识别）容易产生重叠。此处推荐直接利用当前强大的长上下文 LLM（如 GPT-4o 或 Claude 3.5 Sonnet）进行**生成式融合（Generative Fusion）**。将多篇 Markdown 文本拼接，并采用 `<source_1>`、`<source_2>` 标签隔离 [cite: 15, 16]。
3.  **来源溯源 (Provenance/Citation)**：在要求 LLM 提取 `Identity_Facts` 和 `Interests` 时，在 Prompt 中强制要求返回数据的出处。例如，输出 `{"interest": "Machine Learning", "source": "source_1: GitHub repo list"}`。
这在学术界被称为 LLM 的**溯源校验（Provenance-based Fact-checking）**，可用于后续的防幻觉与错误归因 [cite: 17, 18]。

### 2.3 构建流程示例 (Pipeline)

整体架构可参考自动化画像提取（Automated Profile Inference）的论文中的 Multi-Agent 协作流：分为 Retriever（信息抓取）、Extractor（细节提取）和 Summarizer（清洗与评估一致性） [cite: 19]。对于快速体验场景，具体 Pipeline 流程图见附录 B。

---

## 3. 防幻觉与事实核查

画像生成中的事实编造（Hallucination）会导致角色扮演失真及用户信任度下降。LLM 可能在遇到空白领域时自行“脑补”用户的职业或兴趣 [cite: 20, 21]。

### 3.1 抽取式 vs 生成式与两阶段架构

纯生成式的画像提取极易产生幻觉。学界推荐的方法是**两阶段提取（Two-stage Extraction）**：
*   **阶段一：基于抽取（Extractive）**。仅允许 LLM 从给定的 Markdown 文本中严格提取“键值对（Key-Value pairs）”和实体验证，不作任何推断。
*   **阶段二：基于生成（Generative）**。将提取到的安全实体作为输入，让 LLM 将其润色为流畅的系统提示词（System Prompt）和世界观描述 [cite: 21]。

### 3.2 溯源交叉验证 (Provenance & RAG Fact-checking)

业界最新研究指出，防幻觉可以引入轻量级的自然语言推理（NLI）交叉编码器（Cross-encoder）。例如，`Provenance` 方法不直接使用高成本的 LLM 来做校验，而是使用一个极小的（~300M 参数）NLI 模型对生成的每一个声明与其上下文块（Context Chunks）进行匹配，若置信度得分低于阈值，则将该标签标红或丢弃 [cite: 17, 18, 22]。
但在黑客松中，更具可行性的方案是 **LLM-as-a-judge** 校验：即用另一个独立的低温度（Temperature = 0.0）的 prompt 来审阅前一个 LLM 生成的 Schema，要求其针对每一条特征在原文中寻找依据，找不到则删除 [cite: 8]。

### 3.3 用户确认环节 (Human-in-the-loop) 的产品设计

防幻觉不仅是一个技术问题，更是产品设计问题。在“30 秒极速体验”场景中，绝不能让用户填写枯燥的长表单。
**可执行建议**：
1.  当系统通过 URL 提取完成后，进入一个“身份确认卡片”界面。
2.  界面上展现最核心的 3 个标签（如“赛博朋克爱好者”、“Python 开发者”、“INTP”）。
3.  设计交互为：“这是我为您提炼的灵魂碎片。如果不准，请随时拍碎重塑。” 用户可以一键点击标签进行修改或删除，如果无误则点击“确认，开启世界”。这种“微摩擦（Micro-friction）”既不会破坏流畅感，又引入了 Human-in-the-loop（HITL）机制，实质性地解决了因信息缺失导致的画像偏差 [cite: 21]。

---

## 4. 冷启动与渐进式丰富

如果用户提供了一个几乎空白的 GitHub 主页，系统提取不到足够的信息，就会面临严重的“冷启动（Cold Start）”问题。

### 4.1 渐进式 Profiling (Progressive Profiling)

Progressive Profiling 原指在市场营销中，不要一次性要求用户填写所有表单，而是随着用户与系统的持续交互，逐步、分阶段地收集数据 [cite: 23, 24]。在 LLM 智能体中，这一概念演化为“渐进式上下文（Progressive Disclosure）”——系统最初只加载极简的上下文骨架，在后续的使用和互动中逐渐丰富记忆和细节 [cite: 25, 26]。

### 4.2 冷启动的兜底策略

当初始画像数据稀疏时，可以采取以下融合策略：
1.  **泛化模板兜底**：如果只知道用户是“程序员”，LLM 可以基于庞大的世界知识（World Knowledge）为其填充默认的宽泛标签（如“对新奇技术充满好奇”），以保证生成的虚拟世界不至于空洞 [cite: 27, 28]。
2.  **主动提问补全**：在使者 Agent 访问别人的世界时，如果遇到未知的情况，Agent 的 System Prompt 中可以设置一个特殊指令：当不知道本人的偏好时，生成一句向对方提问的话语，或在后台异步向用户本人发起询问（如：“在某个世界里，遇到了两杯魔法药水，我该怎么选？”），用户的回答将立刻补全到画像的 `Memory_Stream` 中 [cite: 27, 29]。

---

## 5. 画像 → Agent 角色扮演的落地

获取到结构化画像后，核心挑战是如何将其编译成驱动 Agent 行为的指令，且保证“使者”能遵守隐私边界。

### 5.1 System Prompt 的编译与模仿

基于 `CharacterLLM` 和 `MRPrompt` 的研究，我们应当采用“叙事模式”及“Magic-If”协议来构建 System Prompt [cite: 7]。
**风格模仿技术选择**：
*   如果语料极少（如只给了一份简历），使用**风格摘要（Style Summarization）**：由 LLM 总结出“专业、严谨、简洁”等形容词，写入 System Prompt。
*   如果提取到了博客或微博等强文本，使用**Few-shot 原文金句摘录**：从清洗文本中抽取 3-5 句最具代表性的原话（如“我觉得这实在太酷了”），直接附在 Prompt 中的 `<example_utterances>` 标签内。实践表明，少量但真实的 Few-shot 对 LLM 模仿特定语气的效果远好于抽象的形容词描述 [cite: 7, 8, 30]。

**Prompt 模板示例架构**：
```text
你现在是 [User_Name] 的使者 (Envoy)。你正在访问另一个虚拟世界。
【全局身份】：[Identity_Facts]
【核心价值观】：[Interests_and_Values]
【说话风格】：请参考以下用户的真实语录进行模仿：[Few_Shot_Quotes]

【Magic-If 情境假设】：如果 [User_Name] 处于当前这种环境，基于你的身份和价值观，你会做出什么反应？请用自然对话回应对方。
```

### 5.2 隐私边界与可见范围控制

团队中关于“来访Agent的可见范围”的争论，其实是对多智能体系统中**安全访问控制（Secure Access Control）**的探讨。
*   根据 `RoleLLM` 的设计理念，应当在 System Prompt 中显式定义 `Privacy_Redlines` [cite: 9]。
*   **具体落地**：使者不能拥有用户本人（King/Star）的底层管理权限。系统在后台编译 Prompt 时，只将脱敏后的 `Envoy_Settings` 注入使者上下文。对于涉及真实姓名、联系方式或敏感财务数据的字段，通过结构化提取阶段直接予以过滤，从根本上实现了“物理隔离”，使者“不知道它不该知道的东西” [cite: 25, 26]。

---

## 6. 存储与扩展

针对“画像、世界历史、人物关系、聊天记录、游记怎么存储”，特别是“要不要上 GraphRAG”的争论。

### 6.1 GraphRAG 的适用规模与成本收益

**结论：在黑客松尺度（100 个用户、几百次互访）下，绝对不需要上 GraphRAG。**
*   **GraphRAG 的优势**：GraphRAG（图知识检索）结合了知识图谱和 LLM，在处理“多跳推理（Multi-hop reasoning）”和极大规模文档网络中具有不可替代的精准性 [cite: 31, 32]。
*   **GraphRAG 的成本**：构建知识图谱需要在摄取数据时耗费大量算力提取实体和边（Nodes & Edges），且对于数据库维护、Cypher 查询语言的学习曲线对于 4 天黑客松来说是灾难性的 [cite: 32, 33]。
*   **替代方案的有效性**：如业界专家在实际应用中指出的，“关系型数据库（Relational databases）加上 JSON 列，对于实现 AI 的持续记忆是非常实用且足够强大的” [cite: 33]。在 100 用户量级下，甚至普通的语义匹配需求用不到向量检索的极限性能。

### 6.2 推荐架构：SQLite/JSON 文档存储

1.  **SQLite/PostgreSQL** 结合 `JSONB` 字段，足够支撑结构化画像和非结构化游记的混合存储 [cite: 33, 34]。
2.  **世界状态与历史（State & History）**：直接以日志形式追加存储（如 Generative Agents 的 Memory Stream 结构）[cite: 4, 6]。
3.  在进行上下文检索时，采用 **Naive RAG**（向量数据库存储记忆块）或简单的倒排索引（BM25），提取相关时间线注入到 Agent 的工作记忆中。这一架构不仅成本极低，且扩展性足够支撑早期的千人级测试版 [cite: 34]。

---

## 7. 隐私与合规红线

作为面向中国互联网、可能依赖微信生态（小程序/H5）传播的社交产品，必须高度警惕合规风险。

### 7.1 抓取他人 URL 的授权边界与反爬协议

如果用户提交了别人的主页，平台面临极大的隐私与版权风险。
*   **授权边界**：爬虫和网络抓取的基石原则是遵守目标网站的 `robots.txt` 协议以及服务条款（ToS） [cite: 35, 36]。
*   **产品侧规避策略**：在输入 URL 的界面，必须设置显著的勾选框（Checkbox）：“我承诺所提供的链接内容归本人所有或已获授权提取”。虽然这无法从技术上阻止用户输入他人的链接，但起到了免责与提示作用。

### 7.2 微信生态内的红线与限制

1.  **AI 生成内容的严格管控**：根据腾讯微信于 2026 年最新发布的治理公告，微信正在严厉打击黑灰产利用 AI 批量生成违规网页并传播的行为 [cite: 37, 38, 39]。微信更新的准则明确指出：“禁止使用 AI、脚本或自动化工具完全替代人工参与的内容生产与分发”，违规可能导致封号或限流 [cite: 37, 38]。
    *   **应对建议**：在 H5 中生成的“虚拟世界”或“游记”，务必在页面底部或显著位置标识“**由 AI 辅助生成**”，并在分享卡片中加入人类（即用户本人）的主观修改环节（这也契合了前文提到的 Human-in-the-loop），以证明具有“实质性的人类参与（Meaningful human input）” [cite: 37]。
2.  **H5 链接拉起与隐私授权**：在微信环境内使用 H5 收集信息，需要遵守微信的《隐私保护指引》。特别是涉及到 URL Link 的生成与分享，需注意微信对外部拉起和接口调用（如 `generateUrlLink`）在不同账号主体上的权限限制 [cite: 40, 41]。
3.  **禁止诱导分享与过度索取**：切勿为了裂变强制要求分享，且收集用户微信 ID 等信息时必须有单独的明确授权弹窗 [cite: 42, 43]。

---

## 附录

### 附录 A：画像 Schema v1 字段表 (JSON 格式建议)

本结构可以直接用作大模型抽取时要求返回的 JSON 结构。

| 模块类别 | 字段名 | 数据类型 | 描述与示例 | 消费方 |
| :--- | :--- | :--- | :--- | :--- |
| **基础身份 (Identity)** | `name` | String | 用户姓名或昵称。例如："Alex" | 虚拟世界/使者 |
| | `occupations` | List[String] | 提取出的职业或身份标签。例如：`["前端工程师", "科幻小说爱好者"]` | 虚拟世界/使者 |
| | `world_theme` | String | 根据身份映射的默认世界类型（由 30 种预设挑选）。例如："Cyberpunk City" | 虚拟世界 |
| **契合度 (Matching)** | `core_interests` | List[String] | 用于量化匹配的实体兴趣。例如：`["机甲", "开源", "攀岩"]` | 契合度计算 |
| | `value_alignment` | String | 人生观抽象。例如："相信技术能改变世界，推崇自由开源精神" | 契合度计算 |
| **使者控制 (Envoy)** | `speaking_style` | String | 语言风格形容词摘要。例如："极其理性，带有冷幽默" | 使者 Agent |
| | `golden_quotes` | List[String] | 提取的 3 句典型原话（Few-shot）。例如：`["代码跑通的那一刻最爽了"]` | 使者 Agent |
| | `knowledge_boundary` | String | 使者应当知道的常识范畴。例如："精通各种编程语言和技术梗" | 使者 Agent |
| | `privacy_redlines` | List[String] | 使者避谈的领域。例如：`["具体薪资", "家庭住址"]` | 使者 Agent |
| **世界历史 (Memory)**| `memory_stream` | List[Dict] | 初始为空，用于存储游记和来访记忆。 | 使者 Agent |

### 附录 B：构建 Pipeline 流程图（文字版）

在 30 秒的极限响应时间内，后端数据流如下组织：

```text
[起点] 用户在 H5 页面输入 URL (或上传 PDF) 
   |
   v
[抓取层] 发送请求至 Jina Reader API (https://r.jina.ai/<URL>)
   |     (参数配置: 启用 ReaderLM-v2 进行智能降噪，设置 timeout=5s)
   |
   v
[提取层] 获取原始 Markdown 文本流
   |
   v
[LLM 解析节点] (基于两阶段提取)
   |-- 阶段 1: 大语言模型根据 Schema v1 进行实体抽取 (提取身份、兴趣、金句)
   |-- 并发处理: 若输入多个 URL，LLM 进行合并去重 (Generative Fusion)
   |
   v
[校验与打分] (LLM-as-a-judge / 极速置信度过滤)
   |     丢弃无法溯源的“幻觉”标签。
   |
   v
[HITL 节点] 前端向用户展示“灵魂碎片卡片” (核心 3 个标签)
   |     等待用户确认/微调 (若超时5秒不操作，则自动默认应用)
   |
   v
[终点] 将确认后的 JSON 存入 SQLite 数据库
   |     -> 触发 虚拟世界大地图生成逻辑
   |     -> 实例化 Envoy 使者 Agent，载入 System Prompt
```

**结语**：
针对“世界互访”黑客松的快速闭环需求，系统应坚决奉行**“轻量级抓取 (Jina) + 扁平化但有约束的结构 (Narrative Schema) + 关系型存储 (SQLite)”**的架构。这一套流程兼顾了学术界在 Role-playing Agent 领域推崇的系统设计原理，同时避免了工程实现上的过度设计（如 GraphRAG），能够保障产品在 4 天内高质量上线并合规运行。

**Sources:**
1. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHDTBbrg7Mw93L7cfOBaQDsuj2OSj8Dlu7t4eFSPFHO5QGSEPSNVn6eoHGjZMqUETaWlzICvTBAT8J44solDTtCi9SSDv3w1jcYco8mgm3Pq_cbN3FUdUQK_sFVP_6J4ck23yt9l-3U4fIq4ABBODILry8eDiRpFnVoM5c=)
2. [character.ai](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFDHe48dACoIQ46FydURrh5qICn-ypoZpRkL7doU95nAoQwda1RvgVHQkVHtCKjj5O9xBK8CkQwhAHD9mx_bLMzjCykTS_SendItlEDYRQEVA9nlf-7-GvallpPNTGOeKipsOwMI9dRMMPSVK_O)
3. [aiinsightsnews.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGxq6hKHem1ZHnrLtE79QMgHhUe3hjnDZRSq1tHH9IfTlXALxzwDpcX5nc529QXX7koq7-U_FlVxrye1hwqJ4sfTZqig5Q01Ma80zcGGvWbaWZHBsYse--5TVzN4zVHdzYFgxbjjatlJxug1PfdtQb5Y_w8En4IUGFd)
4. [arxiv.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFG72yDia8tvxc0wQzYKc8_OYIngb1i2J5Ewusy_LY_C5tAe-wkydIuUeKq-5ciTxhsJvtOCwIJwyGvv_uz4nVT4lAJM5e5HjXObtAgIfzox2i5Svy2BRMYDFHMC-u_41byBg==)
5. [abhinavchinta.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGeLT1l2XL4mqrDj_9cOX5sRl9HAcOa1wuA_q4hFMHbmH4xkfceIFNpxTjRIxENuJfnby7BhkKnQuUIFTC5xeciRXIigL6MZ0wY-BFdFpK0rS4vaAOH0YtoeGVrwQOfpEbH0NXHYB2d65ZNSLfm9gsb)
6. [arxiv.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFgjYlY4zVeVGZ1383fQhQI1vfnWKOAYHXpXIFS_i3tOUe8Xo3m5GmK25fxpQ8uKZXOVz2FFoX5XW0lNT63Rz0OmGfMQuqYnPPKeGTkzGKgP9dzlFmUXw==)
7. [arxiv.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHZTjslXDSuBs09Y-tLA08IWeFIjqlzdVGLtkVlPPU8denFrcNOWMO1Y5lxGGOO5PmzWNt1CBBmUzx7jwURUKs8E79AAA2_UWacFRSsiSsDTiJH3bHShBDoaA==)
8. [aclanthology.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEpVJSWX0x39f-fDn4CQYt64dQ7ruytnxYsp3PoVUhWSv_WPkgpAenUG_ppm6gy4zbXTDwLLZdrO4AQpD0gRs1s_CWtpiS5tj98Dohcbu6M6dHTo7ZBiTK9wgnw4vFIlp3OCqPc3F4K7Vw=)
9. [emergentmind.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGi7i3OMqVACKEFlZjPT5ss7N1845S5z0yyCcV9_HMXSzzHHaE1FO2Eg-aNFuJrfDwhQXStDDS9PBwE8ZZa3-3-rl-y_fULjLztGOaJImaqRT1_Kl07Ri3TwngQp6CiGdie)
10. [elastic.co](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE2iBmiVX661a3Myd3MIPneKjcyL9tRuE0E5YxhWVGtir4dI2ZybLW4n7C3jPfY1sncj9tG0pEu1WnEBmpUyStxaRAeC9TVHGtxvbWJqca9qd7MposlVPQ4MKtvgcd_XdNj95edE1RtSL1R4Wiaol2trAAgWNqoqc4ffSqm)
11. [jina.ai](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHv2jU5zkZ1gc_5VbRwzEA-kq78duC7Q6xeXVNrenIORNAh7xaqwtTqO83k5bsgUwFy-GOCabEG69-bdG4cp8kW0iutts7mxBEE63aYPQ==)
12. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHmWz2DwpFWg0NMeeIwbkb9hoTQOGxQ93214Kpc-W75mp8cKcwtjafZXB6Pa1Dp7ydJYyXU7qyT0DKLts1U2tOc-1OsbqW-Jwesjmozt9_Uzch9W93aiXDpQDnr7BRy2a3LKMDB-kw8W_D009ubyaaITnQ01Pjtxc12roKaVC9Tx5L_zzsFmiGAkDIdO89ZiyOh7DDPK9jAg6kekv8qoJNumzQv0TFF)
13. [webclaw.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG7s0OML8tz9EF9Pj0683Ze2PAIdMeXZv8ycMhhO8bfZUsi2DjDnI6BU-WANZyaHCe9tOFrpA-lQ2JGUU4V1yC5EK3RVo-L9o3cEmep67cdoaQlLLv60Ol_kmOqqYaH4-IsRD3tfUdrgYWraWVrJoJgw1JPcyRE)
14. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFACdM9fdV-J9SQeE30W0VyucKAxC5eyYsG_vhA6ld72qwCCpNZVEuX8i5wZCLoizbYKrFsg55gds93u1XnNk6eZrr9YFh1uhfhflSWe62Ua5_g8SFMdAXwfQe0RNhKgcSVqNGnQIPfKpzqOnWho4GZfKhsdUH-fKjJY5XbDReQdQmdhkqwku3-Y8h9gGxV2g==)
15. [emergentmind.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFi97Ipb7oMw6Tfyl0YEEthrT5lHNpZ-M8rzJzor3YHBnqOFlmDw0oJDWfJ8Ro5WEW3XO9NE_wu5lL3E9k5mmIgI9SDsbfxAtOUj_GuqJwY_9XW6GNqOJD78o69XSmmAAmSkdqnt-HWnymo3QmSevY_Zah3y5ELCg==)
16. [reddit.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFoDfAyqREMo6BpQgmynFB8SLNsoCnwkwFBR9pyNcJ20Xh-wxf6O0zboewPdEY7Otz0XonpLFKYhXsVwl3QB8Kaq6YXJD3zwVA6_ZnzVXMegJHfkPJYZHB6PegcNYD481kY0FR1bZf7xWa_Jtb7ycHc9nmZUmdfYSNMd86KDQeLZdwIBmfURY1HtvrlnViiCgJ49PRZvVPC2IcYyvzmMWyv)
17. [liner.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFKCaleFDuqh9ZQnVxYfegCEoYSJoyUG1DKJCTcmiKcULMd_dLAvp4aNlRaTjRr3XEphpR0qi8JIg19ZmbLJax93LFwwGZsL3BIrng7rsQu0P1s1xTgbFZ-dlehI4UneaC0Y7DX9Yn-KJJLNlurz8R-o1QTADnRIRYWAib5kUHzLbdnyonvOxiFOvAkYqI1cAyP0Loye2mw5PN6g15QmzE=)
18. [aclanthology.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGPN8-ZkWUT8QUXfs6YVN1Qnlt-6dWUthlILJiocbwLXWxlM-qNVlhb_8j0qTo-oeTJXTaRrzMgFJxpUaLh36RYTjINLxPjaOCLvi3s7FQ933KtwPTpPjS5Yoc-Oi-zwEj9fR_MKF5gC5Y=)
19. [arxiv.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFSJw9OjYUd_3l-lcYdAfS1n3t2UDio2qhbHpd8TnM5KwPgW6W0LQOrZiZU4s8uXurBnOzXMqAH2sMRpymy-yhS2e9X465J_eO9F15yIT0_W7o7Tj9b7rFx0A==)
20. [aetherlab.co](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQECkPGJ5l5lnchYB7f3NHjBV6Bz1stmVkvyoZYQe7Zpi6ikN3-GocuBB9GWuYX4vgJGXIxut3-GSkP8QjLdzTIO1L8U7zln-csuMAF_cl433hOar6WBhA5T4YeM-UlezGMsnobWNTrlcDGrGNmMGM6Tl2lj)
21. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFhb67YwXstxOC2IPpsQnfBWcOzmOpHE9ot6BJj4Bw3QPaTpJeeRoDqO29NOzkQa6c4leX10lqEQ6pCiep2NCwHm3C2CCNKxSFwmocuP0eVmVSlOMV60DAR_ipsbNE_fg4TiXFTNCdfvRkQCP6EW-cwXYmn0bB72Z8PluKdDX5-WoiSWLaG_b5hUvP5JZStVNVPpRmVjJxAcI7UkjGNtVEGCG8ouCLJcbSkkkEBmt-YG3Ea897scO2qkCxIJ0Tn)
22. [aclanthology.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFohmEwBmKBM5mJ9tpztW5SFruphwqPX1TCuPyYG-pXlbWWyYxbJpFGEPbaVsMoc_g7ON35GGHFFW_PH4ZXDg_mIDu4HoNAfwKA-EAzTcBOlDN2s2G6uW2MjHxQxxYZ3TuwbJoyl54=)
23. [emarsys.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEoLv_TIqTnYTJ1GiZPGdSsDESvYqKVOCEI2qS6twTDIGjvqFONtOh7Z6rEXmiXY4DK3vyPjRf_C-U-3CrqF7HWLVqjfRN1MRnOQlfSWm4iwQ5GmD_tOf95ZXr8hF7sT3QqEFnwdnZJGkwzg7iuaZs=)
24. [auth0.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHlELKSRCT-nFoS7ljWONTYxR78PMQjGxbki21FXQ0_OjAWkR4h_dfktvudjKRfUn2z7tjVkbDQ50OHDpjw21gifIuG4qrO-3qX6aInw5fTqY_le5NSBeLMbzKXJdmPl3dyjGgv5mdlZtGgyMo9oMFWZYHxGLNRJhFBNwZawwpFL3m1NRaB7otj0aWV)
25. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHboCEWxmMfgzXdffnkdMM1tGA8uXUjm20zIRpPNT9U5XfQTStZC7Ym8VY91FtEhg99rARqJlx9huD0D84GdYDT74u46eEZjRV7nPMjW9O52P83ZUM0RGtC_T_EaRRTou_jldUc-HjTGS_Pe3ZURFIMNrQEI04jWr-xl4NlPLL6wWRd-RZUJf6bIPvynwHMrtTeeT7z3JHpcpQKQBbQgcEeSGFwpbY_EPrS5-CkyuPEgIC9j9rXLeFTeQ==)
26. [mindstudio.ai](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEOKU5rF6vtqpQFDbfdyMND5yjFH2AsFYXpS9CkRwvoYc6NbuOiGdMkvb8QTKgFgYOj6Fp3-gWMLoSq-aA8c79GdR9YwdKOOjMa_kpUvBvVbu1a3SjdFoj0SbR8pswwR-sDTohMSp73nDd4pA4nbTBsDdgITxdvQxZ3KtemmD6-BZS4Z2NwimmV)
27. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHVSJ5i700x9lSbvRL4xTVWtH8N7ofMqj1TCA4bcevslwXsSYIkDTotmANXOX4ggsJ1FnXIKkabkzduTD8dSqWr6DBQHRi1xXCZU4iCVgwY7wiqrKXuHOW0FCpmXpf8jc0PPFzTWq7Xt-B7asBI2Tx1YZXlz2Ri0nToZpgAwvK91F9YjSVZhddoGy758Sax4F54u8JqTbh4ztKYFzVntg4-E1MNncmoK-vvLfxSb3jdrzGR_Q0ksPc_VRLAv9KaAiTWyYc=)
28. [arxiv.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF1sBR1v_bvt4-ZsYZ4Dm7NGqw8-98yYxYt_J78mi3dXhaaB7zdIcmNHQo5iwy8f5rSDEw2AMHWraN_pV5iNDwvRWXsLJfFTy2hfJKJ-HQ-itZdcxOMmsx3ug==)
29. [arxiv.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGraF-vTqer_OYmTeqh7m-1NlOWstM1t5jEeSEbxTCWapzQqe7tgVuYIu5ecooEaDQ9fJAUMln9Je021-t7chC9ulgRty6q8fpXyiIHB8lIxAgEyH3Gsgt9yA==)
30. [arxiv.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH3Tnhi0zsgbkGCNtzxX_dSeROEofyPu9NTZMaz7Dd0h5vy2MhpE88ZSn9PnqB_Cvqxg0GJ-5mG7C1zkHSMh5I1SGlaLvgbcSUvu16mIhSUA-bqOJNGGjmrMQ==)
31. [machinelearningmastery.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEmO3qFZ8X0Yf7bzRqK3TPm4fgaXj7UbJZOuRzuSrmjYakEhddLp-ODTXEAnnVVYGiv7eSOdptaQtzr3lwEe9a4h9DgdU_Bc2YOTm0ylKrtMqWUOjb7Ye2wC5o-QKEiNe9h2abtcA99AS8MufqW48EQMU5jEE_4fxLl1uSniyxhNHhtHylJRrYyow9NvDVv5LBUqMJGsPD5fgjX)
32. [falkordb.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFrGXrE3TTDzg913u3Q3RpM-ep6M81hfwMJm8bmfk8b-7AxHkJ0A_GRlDuhdLz88Ysn_tzmxzZYQRAE4wFp4kt9MPLJNmWkvmmplqspKn33700FEZIsqouBNWQ-PoAZcbIY-jl9HxOoGnMh6EnU)
33. [ycombinator.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHE_xTm11UOIbdo5j3bkUf1KvCIR05d1ySRpqCNGyrhqRe7C_mmjoJ0sQAlHJtsvzU58anCQ9XTO3NlQfdNqa3zIwGtd1AnzeDHKeQAOcpAclMxf1FK_ky7r8WsjQbB97RcyJc=)
34. [dev.to](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHwxUrTNwn6q4veqlg4ipTuRIWJs3JNpGjvPB2gv-1wynODzyVR-yVuysshpN_SI00snJNN3NPBfU8S56F9M3z654GZk4dn0aMbiRK-1SRQn9mUhtZqkTN4YsbB0o03Z52KCboVPhiku6-4uKPbf4u9NVTJcZgQuQiFpIBsA-hRReCJm_cYLE9jEMYcOMA=)
35. [rayobyte.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFZWtF9q0Ug_swKQeMb8yzUSB7Qr5cVIsTzYtbPoKWhNrape0ohTuhWBVqS_0w8f9MEQHefXEzrxOqrU5MTsc89RpjztEhwUaKOLrT9cgDhuxpCrIFqRFx5hju-0jFRjkY=)
36. [pandaily.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE-CAlGGr4yv8z6jJ2QjGTGn-1ek0jDItWPsKIqrt5kq91fztqREvtsFwZZn4qtXStFXaXkhR_UZMjc4j0sZvGDECqSDsiHzXOXZWJzPFVgq6lBKZVmb2Yn-jBS7HNdq4pijvZ9E-H0Qg5Bl37myQ_zMIBniYfvfIVYkgFTvb2-6q8tECHhbe-6awqy9ELOLBbNMdW_WrnJ95ggj4yc5T5Tkier_99kOujTUU5w7HgEprz0X7H5Mwd5zJa09x8=)
37. [citynewsservice.cn](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHG6bry9qyWLHjypUDD9T6hwaxtJaDPvKnaBDc4Zq6b5xDaM7XV5fSI8FVMdvMUKTWk20Kmo3l3k6M9ghMd6aMwVeqQKbWJayH-w-0cyd-68Vz53xSW5r95XRz8wep2kZRANM3K0VL74J90sV6Vsqkfv1Z62tGxwau8ydqY3uazAQsuaCRw_nq0YcrKI40rfhPGcRMKfD07LTIkz-Bbgk4JZklLOQA1l4W80EILupvRLyIUo6UWyxBvZ39F1VwqjbqH)
38. [scmp.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFZdX9jXG5IKQrm3t_X8RromhQ2OltVjfDxbP3r3d_6u2rvt1ANPBLCY7X51x3T8pYdtsZ1tbs7mKdDBrDcJcUAgCHibFF7QakHdGXAGoNWTRcQoMVXlQJGnH4M61hzqDXF1gNgmTHKVXAphzE_fGgB7I8MZ8kQ9tFxkpNhqXhajHlZZUq3vGmreDsUl3L_MLU3llGLAGw-Ex8=)
39. [qq.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHI1q0Wy1W0pqQ1DqRi8eaTo4JgSuCDr85FCjOxah7QBH8Pl6bfV6fRK1EZM3O4r82aaofYWKgGZZbOYfQQHJyVRilLlmjTYreufMcrtpzIz5K9DyZ7S4q3j0aztTLl6U1m)
40. [qq.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE53aGNnMjP-fI5OMSHDuKd8fgRZA65NLVU4qGBzooLit_DpQWs04yWmNTClUr4S__Hkj_3BRYXRR04cPpviBwl9Hr9TF7IqjQ1Mlz_cM3-p6KGSQCMQgNYupC5kMS4rsDLX286XPuSuOJuLCVgD0FBbW17vZNFJ1G9DFn7zJ8ssUq7F-PtNz78KiaNQJ_eXlgh)
41. [meitu.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFko_EcIn1vc9-mhI54iLjVkfQsyZaeYTPZAhYxU8IKK9VpFnz8Q__oh_FZPRlKPWYNOYohAEHHS5q6GMZ9htiPtdjjF4ErgPnvGh_DhZtvCAKOh46Qj2YuOn7lyu8NcdpsKXfCJvsJcqNH6jhQuS3L)
42. [wechat.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpMmmAufzlVhr1yg0g8zNIYb-w2Dv78fMcjlEjAxeFwISyJYiSSfRFOFLpXQPSPu0MyilPXUSt5jj5q_hW_wbsd-I-6UkNW4eN7wie3VSY1lmsi1HNBPAQWo_0mbOXYic0N7M=)
43. [weixinhost.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEzNdCK0sr9honhfvh-CnIWODxVW6oYHbV7buE1S3aiSieCK2GdHhrsU2oo5sBNC2S6oI9NJo4recpplwfeueMU2MmHRULTk1MR0fmbq4t1G_s16Wg=)
