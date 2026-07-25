# 近场通讯技术用于人与人之间的数据交换和群体发现：截至2026年7月的技术边界调研

本调研报告旨在深入解构截至 2026 年 7 月移动端近场通讯（NFC、UWB、BLE、Wi-Fi P2P）的真实技术边界。报告将穿透各大操作系统（特别是 iOS 18.1 至 iOS 26 的历次重大权限放开）的底层逻辑，解析其在「群体发现」与「数据交换」场景下的实际表现。同时，我们将剖析中国大陆独特的技术生态（如华为鸿蒙与互传联盟架构）。最后，基于真实的工程约束，为大规模并发连接产品提供最具现实可行性的技术选型与架构建议。（注：本报告包含复杂工程架构与系统级 API 解析，仅供信息参考与技术选型探讨，不构成任何安全验证、合规审查或商业部署的专业指导建议。）

### 执行摘要 (Executive Summary)
针对「近场通讯技术用于人与人之间的数据交换和群体发现」这一议题，核心技术能力与系统边界总结如下：
1.  **NFC 的真实能力边界**：物理带宽上限极低（106-424 kbps），单次交互推荐负载在 1KB 以内，已完全退化为「瞬间意图确认工具」，无法用于群体并发发现与数据交换。在系统生态层面，iOS 18.1 已向第三方开放 HCE（主机卡模拟）读写权限与 SE 芯片，但受限于极其严苛的商业授权（Entitlement）与地域限制；而 Android 侧虽然一直开放 HCE，但在锁屏与息屏状态下受到严格的系统级管控（息屏时 NFC 芯片直接断电）。中国大陆则绕开纯近场传输，全面转向「NFC 握手触发 + 蜂窝网络/Wi-Fi 高速直连传输」的混合路线。
2.  **UWB（超宽带）的空间定位局限**：搭载 Apple U1/U2 芯片及 Android 侧的 UWB 硬件虽然能提供厘米级的绝对方向感知与精确测距，但在高频双向测距（TWR）下功耗极大（活跃监听与发射电流高达数十至数百毫安，功耗超 100 mW）。UWB 纯粹是「已连接设备的空间定位器」，其依赖 BLE 建立初始握手，**绝对无法**独立用于 20 人规模的初始后台无差别人群扫描与并发发现。
3.  **BLE 的广播限制与 Mesh 网络现状**：BLE 是泛在近场发现的基石，但在 iOS 平台遭遇严重的系统级打压。第三方 App 在退至后台时，广播的 UUID 会被强制塞入哈希「溢出区（Overflow Area）」导致不可识别的哈希碰撞，且后台扫描频率遭遇节流惩罚。过往如 FireChat 等试图建立 Mesh 通讯的网络，受限于 iOS 多点连接（MultipeerConnectivity）硬件上限（最多 8 个节点），面对 20 人的并发规模在原生框架内直接崩溃。Apple Find My 网络的成功依赖的是第三方开发者永远无法触及的底层系统守护进程特权。
4.  **Wi-Fi 近场高速交换的技术破局**：在跨平台一对多数据传输上，Wi-Fi Aware（NAN）成为了历史性解法。AWDL（Apple 专属，速度 160-320 Mbps）与国内安卓厂商的互传联盟（MTA，速度 20-80 MB/s）长期割裂。但随着欧盟 DMA 法案的落地，Apple 在 iOS 26 全球解禁了 Wi-Fi Aware 框架，使得 iOS 与 Android 首次能在不依赖路由器的情况下，实现 100-250 Mbps 以上的纯近场无中心组网高速交换。
5.  **20 人并发发现的综合架构判断**：如果必须实现「20人房间无感并发发现与 Agent 结构化数据交换」，**纯近场方案存在极大的设备兼容性碎片化缺陷**，且面临 iOS 玄学杀后台的风险。当前最可行的技术路径为**「混合架构」**：近场 BLE 负责动态信标握手，主力数据交换上浮至云端虚拟房间处理；当检测到无外网时，才降级调用跨平台 Wi-Fi Aware 集群网络；对于物理相邻房间的「穿墙串线」问题，必须辅以超声波 Token 握手或 Wi-Fi BSSID 精准比对来完成地理围栏防溢出隔离。

---

## 一、 NFC 的真实能力边界与生态演进

### 1.1 物理边界与点对点（P2P）模式的消亡

**背景与现状**
近场通讯（NFC）的设计初衷是短距离（通常在几厘米以内）的安全射频识别，其工作频率被固定在 13.56 MHz [cite: 1]。这种极短的通信距离物理上隔绝了远距离信号监听，但也注定了其在「群体发现」场景中的缺席。

**数据与限制**
NFC 的标准数据传输速率极低，仅为 106 kbps 到 424 kbps [cite: 1]。由于 NDEF（NFC Data Exchange Format）记录的实际可用容量通常在几百字节到几 KB 之间，NFC 根本无法承载结构化大文件或复杂的用户 Agent 档案的完整传输。
在架构模式上，NFC 历史上曾定义过三种模式：读写模式（Reader/Writer）、卡模拟模式（Card Emulation）和点对点模式（Peer-to-Peer）[cite: 2]。然而，在当前的移动操作系统生态中，**点对点模式已经彻底名存实亡**。Android 平台早已废弃了基于该模式的 Android Beam；而在 iOS 侧，尽管 iPhone 7 以后的硬件具备理论能力，但 Apple 的 Core NFC 框架从未向开发者开放过点对点 API [cite: 2, 3, 4]。

**工程影响**
这种演变意味着，今天我们在智能手机上使用 NFC，本质上是一种**非对称的「主从交互」**。两个手机之间的 NFC 交互，实质上是一方作为「读卡器」（Active Reader）去读取另一方模拟的「被动标签」（Passive Tag），而不再是对等的数据交换。

### 1.2 iOS 平台的重大破壁：从 Core NFC 到 iOS 18.1 SE API

**早期限制**
长期以来，iOS 上的第三方 App 仅能通过 Core NFC 框架进行受限的操作。Core NFC 仅支持标签读写模式（Tag Reader/Writer），开发者可以读取符合 NDEF 格式的标签，或者与 ISO 7816、ISO 15693 等底层协议标签交互 [cite: 2, 5]。但开发者一直被严格禁止直接访问控制着支付与身份凭证的核心安全硬件——安全元件（Secure Element, SE）。

**iOS 18.1 的历史性开放**
2024 年底发布的 iOS 18.1 标志着 Apple 生态的重大妥协。Apple 正式向第三方开发者开放了 NFC 与 SE API，允许第三方 App 在脱离 Apple Pay 和 Apple Wallet 的情况下，实现独立的非接触式交易与卡模拟（HCE）[cite: 6, 7, 8]。
这项开放支持的场景包括：店内支付、车钥匙、闭环公交卡、企业门禁、学生证、酒店钥匙等 [cite: 6, 8]。

**严格的授权与地域限制**
然而，这种开放是带有重重枷锁的。
*   **商业授权**：开发者不能仅凭代码调用 API，必须与 Apple 签署专门的商业协议，并支付相关费用，确保其符合 PCIDSS（Payment Card Industry Data Security Standard，支付卡行业数据安全标准）等行业安全标准 [cite: 8, 9, 10]。
*   **Entitlement（授权标识）**：第三方 App 必须在 Xcode 中配置两个特殊的特权标识：`com.apple.developer.secure-element-credential` 以及 `com.apple.developer.secure-element.default-contactless-app` [cite: 9]。
*   **地域限制**：该功能并非一蹴而就的全球开放，首批仅在澳大利亚、巴西、加拿大、日本、新西兰、英国和美国可用 [cite: 7, 8]。
*   **交互机制**：用户可以将其设为默认非接触应用，通过双击 iPhone 侧边按钮唤起，但底层依旧依赖 Apple 的 Secure Enclave 与生物识别鉴权 [cite: 8, 9]。

### 1.3 Android 侧的对应能力与 HCE 底层约束

在 iOS 历经磨难才逐步放开权限的同时，Android 平台自 4.4 (KitKat) 时代就内置了主机卡模拟（HCE, Host-based Card Emulation）机制，允许任何 App 绕过物理安全元件（SE），通过操作系统直接与 NFC 读卡器对话交互 APDU（Application Protocol Data Unit）指令 [cite: 11, 12]。

**并发与容量限制**
尽管 Android 生态更为开放，但第三方背景下的 HCE 数据交换仍面临严酷的工程边界。Android 的 HCE 仅支持单逻辑通道（单线程执行 APDU 交换），且官方开发规范强烈建议第三方 App 尽力压缩数据包体积与 APDU 指令往返次数，**合理的交互上限应控制在 1 KB 的数据量以内**，以确保用户在贴近设备的短短 300 毫秒（ms）内能顺利完成射频场内的通讯 [cite: 11]。任何试图将 NFC 用于传输结构化大文本的尝试都会遭遇场强中断或握手超时。

**息屏与锁屏的系统级封杀**
在安全与功耗管理的考量下，Android 同样施加了严格的生命周期管制：
1.  **息屏状态（Screen Off）**：当设备屏幕完全关闭时，Android 操作系统会在硬件层直接切断 NFC 控制器与应用处理器的电源 [cite: 11, 12, 13]。这意味着息屏状态下的第三方 App 绝对无法作为标签被扫描发现（即盲扫唤醒在息屏状态下彻底无效）。
2.  **锁屏状态（Lock-screen）**：在屏幕点亮但未解锁的情况下，HCE 服务的存活取决于开发者在 `manifest` 配置文件中声明的 `android:requireDeviceUnlock` 属性。在 Android 10 及更高版本中，如果用户在系统设置中开启了「要求解锁才能使用 NFC（Secure NFC）」，那么无论开发者如何配置，第三方 HCE 服务在锁屏下都将不可用 [cite: 11, 12]。
3.  **AID 路由冲突（Application ID）**：Android 系统通过 ISO/IEC 7816-4 规范的 AID (最多 16 字节) 来区分需要唤起哪个 App 进行 HCE 处理。开发者若部署自有交互逻辑，必须向系统注册自定义 AID；但一旦遇到应用层级 AID 冲突，系统会强制弹出默认钱包选择界面打断无感握手 [cite: 11]。

### 1.4 中国大陆的特殊生态：微信/支付宝与华为鸿蒙的「碰一下」机制

中国市场的「碰一碰」生态走出了与西方完全不同的工程路径。它们并未死磕 NFC 极低的数据带宽，而是将 NFC 纯粹降维为**「近场意图触发器」**。

**支付宝与微信的「碰一下」支付**
2024 年中，支付宝大力推广的「碰一下」支付，其本质颠覆了传统的「卡模拟」流程。传统的 Apple Pay 是手机作为「卡」，POS 机作为「读卡器」。而支付宝「碰一下」采用的是**读卡器模式（Reader/Writer mode）** [cite: 14]。
商家的收款设备（如长方体小蓝环）实际上模拟成了一个包含特定信息的 NFC Tag [cite: 14]。用户的手机在解锁状态下，利用系统底层的 NFC 读卡能力读取该设备的 Tag 标识，随后手机 App 通过 4G/5G/Wi-Fi 网络与云端服务器通信，在云端完成身份验证与扣款逻辑 [cite: 14, 15]。微信的跟进测试也采用了类似的云端握手机制 [cite: 16]。
*优势*：这种模式绕过了 Apple 复杂的 SE 权限审核，因为任何具备 NFC 读卡能力的手机（iOS Core NFC 即可）都能读取 Tag。
*缺陷*：强依赖蜂窝网络。如果没有网络连接，「碰一下」将彻底失效 [cite: 15]。

**华为鸿蒙（HarmonyOS）的「碰一碰」分布式软总线**
华为的 HUAWEI OneHop Engine 展现了无云端环境下的跨平台数据流转极限。当两台鸿蒙设备碰在一起时，整个交互在 0.5 秒内完成了复杂的接力 [cite: 17]：
1.  **物理触发（NFC）**：发起端通过 NFC 读取被动端标签，仅获取 MAC 地址和 DeviceID（短短几十个字节）[cite: 17]。
2.  **身份鉴权（BLE）**：通过蓝牙广播快速寻址，完成握手与密钥协商 [cite: 17]。
3.  **高速通道（Wi-Fi P2P）**：底层的「分布式软总线 2.0」介入，自动建立 5G 频段的 Wi-Fi P2P 高速逻辑通道 [cite: 17, 18]。
4.  **状态流转（FA Migration）**：如果是应用接续，并非传输像素投屏，而是将应用的当前状态（状态流转，即 FA Migration，Feature Ability Migration/元服务状态流转，例如视频播放到 10分23秒）序列化发送，接收端反序列化并拉起同名应用 [cite: 17]。
这种纯近场架构不仅速度可达 100MB/s+，且对开发者封装得极其优雅，完全屏蔽了底层的网络异构差异 [cite: 17, 19]。

---

## 二、 UWB（超宽带）：精确测距与方向的现实考量

### 2.1 Apple Nearby Interaction 与 U1/U2 芯片演进

**核心机制**
超宽带（UWB）技术通过发送纳秒级的脉冲电磁波，利用飞行时间（ToF）来精确计算设备间的距离和相对方向。Apple 自 iPhone 11 引入 U1 芯片后，开放了 Nearby Interaction (NI) 框架 [cite: 20, 21]。

**最新硬件演进：U2 芯片与 EDM**
在搭载第二代 UWB 芯片（U2）的设备（如 iPhone 15 及后续机型）上，Apple 引入了**扩展测距（EDM, Extended Distance Measurement）**协议 [cite: 22]。这使得设备能够在比第一代 U1 远得多的距离上进行高精度测距 [cite: 22]。
然而，在第三方配件集成中，U2 芯片表现出了一种特殊的后向兼容行为。开发者发现，使用第一代 U1 芯片与第三方 MFi 认证芯片交互时，能够同时获得距离和有效的 3D 向量方向（x, y, z）；但在 U2 芯片上与某些早期协议交互时，系统仅返回距离信息，丢失了方向感知 [cite: 23]。这要求第三方开发者必须遵循最新的 Nearby Interaction 协议规范来适配 U2 的全量能力。

**后台能力（iOS 16+）与免提解锁（iOS 18）**
早期 NI 框架要求 App 必须在前台运行。自 iOS 16起，Apple 支持了 **NI Background Sessions**。只要设备预先通过蓝牙配对连接，即使手机锁屏或 App 在后台，也能持续进行空间感知 [cite: 24]。
这一底层能力直接促成了 iOS 18 中智能家居领域的重磅功能：**UWB 智能锁的免提解锁（Express Mode）**。无需掏出手机，只要用户靠近门锁，UWB 的高精度测距就能触发自动开锁 [cite: 20, 25]。

### 2.2 Android 36 API 与群组多播（Multicast）

在 Android 生态，UWB 标准化进程也在加速。最新的 Android 36 API（截至 2026 年）中，原生引入了对 FiRa 标准定义的多播测距支持——`CONFIG_MULTICAST_DS_TWR`（多播静态 STS，即 Scrambled Timestamp Sequence / Secure Time Sync，加密时间戳序列 / 安全时间同步，双侧双向测距）[cite: 26, 27]。
通过诸如 `addDeviceToRangingSession` 和基于 RawResponderRangingConfig 的底层 API，Android 允许一个主设备同时将多个目标设备加入到一个 UWB 测距会话中 [cite: 28]。这标志着 UWB 从「一对一」的寻找，开始走向「一对多」的并发空间感知，显著降低了传统轮询机制带来的时延。

### 2.3 工程可用性与限制：「知道周围谁在哪个方向」

**技术理想与物理限制**
如果需求是「精确知道周围 20 个人的相对位置与方向」，UWB 是唯一能提供厘米级精度和空间角度的技术。
然而，其**致命缺陷**在于初始发现机制与高昂的功耗表现。UWB 本身通常不用于「盲找」（发现未知设备），它必须依赖 BLE（低功耗蓝牙）作为前置的带外（Out-of-Band）握手通道 [cite: 29]。只有通过 BLE 交换了安全密钥和 UWB 时间槽配置后，UWB 测距会话才能启动。
此外，UWB 双向测距（TWR）会产生极高的脉冲发射频率。根据行业定量测算，以典型的 Qorvo DW3000 / DW3110 UWB 芯片组为例，在活跃的 TWR 测距周期内，其发送和接收电流通常高达数十分毫安（tens to hundreds of mA），整机有功监听功耗轻松超过 100 mW [cite: 30, 31, 32]。尽管部分极低功耗专用芯片（如 3db IC 架构）在 1 Mbps 速率下可将生成单发脉冲的功耗压至 35.64 μW 甚至更低 [cite: 33]，但对于智能手机内部广泛部署的高速率脉冲（HRP）UWB 模块而言，如果要求主设备在短时间内轮询或并发维护 20 个独立设备的 3D 空间测距会话，会导致电量发生断崖式急剧消耗，并迅速耗尽天线射频的时间槽（Time Slot）带来严重的数据包拥堵。因此，UWB 仅适合在「已通过其他技术发现并握手」的少数特定目标之间，进行按需短时开启的空间定向。

---

## 三、 BLE：广播/扫描机制与群体发现的残酷现实

### 3.1 理想的发现协议与 iOS 后台限制的碰撞

BLE（低功耗蓝牙）是目前设备泛在发现的基础网络。理想状态下，一台设备不断广播自己的身份 UUID，周围设备持续扫描并捕获，即可实现完美的群体发现。
但在移动端，尤其是 iOS 平台，这一理想遭遇了系统级功耗控制的严厉绞杀。

**iOS 后台广播的「溢出区（Overflow Area）」黑盒**
当一个 iOS App 从前台退入后台，如果它试图继续作为外设（Peripheral）广播 BLE 服务，Apple 会强制进行数据阉割 [cite: 34, 35]：
1.  设备的 `LocalName`（本地名称）停止广播 [cite: 35, 36]。
2.  原本明文广播的 128-bit 服务 UUID 被系统接管，放入一个称为**「溢出区（Overflow Area）」**的特殊制造商自定义数据中 [cite: 35, 36]。
3.  这个溢出区实际上是一个 16 字节（128 位）的**哈希位掩码（Hashed Bitmask）**。Apple 使用不公开的专有算法，将开发者设定的 UUID 映射为这个 128 位掩码中的特定 1 个比特位，并将其置为 1 [cite: 37, 38]。
*后果*：由于可能的 UUID 数量高达 $10^{38}$，而掩码只有 128 位，严重的哈希碰撞是不可避免的 [cite: 37]。其他设备在后台扫描时，虽然可能收到回调，但根本无法确切知道对方是谁，因为多个完全不同的应用可能恰好设置了相同的比特位 [cite: 37]。

**iOS 后台扫描（Central）的节流惩罚**
在后台扫描方面，iOS 要求 App 必须在 `Info.plist` 中声明 `bluetooth-central` 权限，并且**绝对不允许进行无差别的全局扫描**。后台 App 必须显式指定目标服务的 UUID；如果传入 `nil`，系统将直接返回空结果 [cite: 39, 40]。
更致命的是，后台扫描的频率被系统大幅度降低，且系统会自动合并针对同一设备的重复发现（忽略 `AllowDuplicatesKey`），这导致实时发现网络在后台陷入瘫痪 [cite: 35, 40]。

### 3.2 大规模实践的成败教训

**失败案例：FireChat / Bridgefy 等 Mesh 通讯 App**
这些试图建立「无网人群聊天」的应用，在早期曾引发轰动。但它们最终都面临了工程上的滑铁卢。致命原因正是：当用户将手机放回口袋（App 退入后台，屏幕锁定）后，iOS 切断或极度延缓了 BLE 的连接能力 [cite: 38, 41]。用户必须保持屏幕常亮、App 在前台，所谓的 Mesh 网络才能维持拓扑结构。另外，iOS 的 `MultipeerConnectivity` 框架在底层对连接数设置了绝对硬性上限，最多仅支持 8 个节点（包含本地节点）[cite: 42, 43, 44, 45, 46]。面对 20 人的房间，原生框架的直接崩溃不可避免。

**成功案例：Apple Find My 与 Exposure Notification (疫情追踪)**
为何 Apple 的 Find My 网络能连接全球十几亿台后台设备？为何疫情期间的接触通知 API 能完美工作？
答案是：**操作系统的特权通道**。这些功能不是由第三方 App 运行的，而是由操作系统的底层守护进程（Daemon）接管。它们不受第三方 App 的后台生命周期管理，能够使用系统级的硬件定时器唤醒蓝牙芯片，进行低占空比的明文广播和扫描 [cite: 29]。第三方开发者在当前 API 下，**永远无法复刻** Find My 的发现效率。

---

## 四、 高速数据交换：Wi-Fi Aware、AWDL 与互传联盟的跨平台较量

要解决 BLE 无法传输大文件（吞吐量通常在百 KB/s 级别），以及 20 人网络拓扑的拥堵问题，必须引入基于 Wi-Fi 的近场协议。2025-2026 年的移动生态，在这一领域发生了地震级的变革。

### 4.1 协议对比与历史局限

*   **AWDL (Apple Wireless Direct Link)**：Apple 专有的底层 P2P 协议。它通过在常规 Wi-Fi 频道与 P2P 频道间极速跳频（Channel Hopping），并利用主节点同步时间窗口，实现了 AirDrop 惊人的高带宽与低延迟（实际网络层吞吐量可达 160 Mbps 至 320 Mbps 以上） [cite: 29, 47]。但它是封闭的，且第三方 App 只能通过上层封装（如限制重重的 MultipeerConnectivity）间接使用。
*   **Wi-Fi Direct**：Android 早期的主力技术。它能建立高速点对点连接，但缺乏「始终在线」的低功耗环境服务发现机制，且网络拓扑属于传统的群主-客户端（Group Owner/Client）模式，管理多个设备的动态进出极为笨重 [cite: 48]。
*   **Wi-Fi Aware (NAN, Neighbor Awareness Networking)**：Wi-Fi 联盟推出的划时代标准。它无需路由器（AP）或互联网，设备在后台定期发送极小的 Publish/Subscribe 帧来发现彼此（Discovery Phase）。一旦发现，设备会在共同约定的同步时间窗口（Discovery Window）内苏醒进行通信，这使其具备与 BLE 相似的低功耗发现能力，却拥有 Wi-Fi 级别的传输带宽（在 Wi-Fi 5 硬件上实测轻易超过 100 Mbps，在 Wi-Fi 6 硬件架构下最高可达 250 Mbps 以上），并原生支持多设备的动态集群（Cluster）[cite: 29, 49, 50]。

### 4.2 AirDrop 的安卓对标：互传联盟（MTA / Mutual Transmission Alliance）

在跨平台基础标准尚未统一的岁月里，中国安卓厂商开辟了脱离 Google 与 Apple 掌控的第二战场。2019 年由小米、OPPO、vivo 牵头成立的**互传联盟（MTA）**，构筑了安卓阵营规模最庞大的跨品牌纯近场文件交换生态 [cite: 51, 52]。

**协议机制与覆盖面**
互传联盟采用的是「移动点对点快速传输协议」。其底层技术选型极为务实：**完全摒弃纯 Wi-Fi 扫描的高功耗，采用 BLE（低功耗蓝牙广播）进行握手与配对协商，一旦目标确认，底层立刻拉起 Wi-Fi P2P (Wi-Fi Direct) 建立专属加密信道用于数据倾泻** [cite: 51, 53, 54, 55]。截至 2026 年 6 月，该联盟已囊括小米、OPPO、vivo、三星（Quick Share 并轨接入）、一加、realme、魅族、黑鲨、中兴、华硕、联想、摩托罗拉，甚至在 2025 年底迎来了荣耀的加入，覆盖全球数亿台终端 [cite: 51, 53, 56, 57]。

**带宽与限制**
联盟官方宣称其平均传输速度为 20 MB/s（注意：是 Megabytes，非 Mbps），但在较新的 Wi-Fi 6 / Wi-Fi 7 硬件设备相互通讯时，实测峰值甚至能逼近 80 MB/s（约 640 Mbps），且全程无需消耗蜂窝网络流量 [cite: 51, 53, 54, 58]。
然而，它的短板同样明显：由于其被封装在各家厂商的操作系统底层（System UI / Share Sheet），它完全不对第三方开发者开放 Public API。第三方 App 无法调用 MTA 协议在其应用内部构建自己的 P2P 房间，只能用于文件管理器和相册中的媒体投送。

### 4.3 iOS 26 的全球开放：数字市场法案 (DMA) 的终极红利

**历史性转折**
受欧盟 DMA 法案强力推动，要求提升生态互操作性，Apple 在 iOS 26（2025 年底至 2026 年逐步推送）中，做出了史无前例的妥协——**在全球范围内开放了 Wi-Fi Aware 框架** [cite: 50, 59, 60, 61]。
此前，Google 已经在 Android 8.0（API 26）原生内置了 Wi-Fi Aware 支持 [cite: 62]。这意味着，截至 2026 年，智能手机界首次拥有了一个统一、开放、无需中心路由、高带宽且支持后台集群发现的近场无线协议。

**Apple 侧的工程落地**
在 iOS 26 中，开发者需要在项目中配置 `com.apple.developer.wifi-aware` Entitlement，明确声明 `Publish` 和 `Subscribe` 意图 [cite: 63]。借助此框架，iPhone 能够与 Android 手机直接进行毫秒级发现并建立 WPA3 加密的 P2P 链路，不仅能传输高清媒体，更彻底打破了传统上 iPhone 与 Android 之间只能依靠云端或扫码传输大文件的壁垒 [cite: 49, 59, 62]。
实际上，在 iOS 18 时代，Apple 就在底层（特别是欧盟区）为其开放文件传输（替代 AirDrop）做铺垫，而到了 iOS 26，这项技术作为通用 API 面向全球完全成熟 [cite: 50, 61]。

---

## 五、 全局技术规格比打与最终工程架构决策

### 5.1 各大近场协议硬核技术指标总览 (截至2026年)

为提供最直接的技术选型参考，下表详细比对了各主流近场协议的工程边界：

| 技术协议 | 典型最大覆盖半径 | 最大实测吞吐带宽 | 最优适用场景 | iOS 第三方可用状态 (含版本) | Android 第三方可用状态 | 活跃通讯相对功耗 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **NFC (HCE)** | 极短 (< 4 厘米) | 极低 (~106-424 kbps) | 瞬间意图确认、安全支付门禁 | 受限开放 (iOS 18.1+, 需商业授权) | 全面开放 (但息屏/锁屏受限) | 极低 (无源/被动场唤醒) |
| **UWB (TWR)** | 中短 (~30-100 米) | 低 (~1 - 6.8 Mbps) | 精确空间 3D 定位、免提解锁 | 开放 (iOS 16+ 后台, 兼容 U1/U2) | 开放 (Android 36 API 引入群组多播) | 极高 (TWR活跃功耗超100mW) |
| **BLE (Mesh/广播)**| 远 (~50-100 米) | 极低 (~1 - 2 Mbps 理论) | 设备休眠唤醒、极低功耗发现 | 高度受限 (后台 UUID 被哈希屏蔽) | 开放 (限制日益严格以节流) | 低 (广播/扫描状态) |
| **AWDL** | 远 (~100 米) | 极高 (~160-320 Mbps) | 苹果生态文件投送、极低时延 | 间接可用 (通过 Multipeer限制8人) | 不支持 (Apple 专有协议) | 中等 (信道跳频管理) |
| **MTA 互传联盟** | 远 (~100 米) | 高 (~20-80 MB/s) | 安卓跨品牌大文件互传 | 不支持 | 系统底层原生 (不对第三方API开放)| 中等 (传输期启用 Wi-Fi P2P)|
| **Wi-Fi Aware(NAN)**| 极远 (~100-200 米) | 极高 (~100-250+ Mbps) | 无路由多节点局域高速集群 | **全面开放 (iOS 26 破壁引入)** | 全面开放 (Android 8.0+) | 低(发现期) / 中高(数据期) |

### 5.2 20人并发发现与数据交换最优解的架构挑战
**产品需求**：「一个人走进一个 20 人的房间，他的 agent 能同时和周围所有人的 agent 建立连接并交换结构化信息」。双平台（iOS + Android）支持。
**核心挑战**：
1.  突破 iOS 后台发现的「死网」限制。
2.  突破传统一对一（蓝牙/Wi-Fi Direct）频繁配对的握手灾难。
3.  确保 20 个节点（20 × 19 = 380 条潜在链路）的拓扑不崩溃。

### 5.3 现实技术路径与「致命缺陷」评估

#### 方案 A：纯近场架构 —— 基于 Wi-Fi Aware (NAN) 集群
**技术机制**：
所有用户的手机后台运行。利用 Android 原生的 Wi-Fi Aware 与 iOS 26 开放的 `Wi-Fi Aware Framework`。所有设备订阅同一个特定服务 ID。当新入局者走入房间，其 Publish 帧在下一个同步窗口（通常几百毫秒内）被 20 人集群瞬间捕获 [cite: 49, 50]。集群自动协商，建立 Data Path 传输结构化 Agent 档案。
**致命缺陷**：
1.  **极度严苛的系统要求（向下不兼容）**：必须要求 Apple 用户全员升级至 iOS 26，且 iPhone 硬件需 iPhone 12 以上 [cite: 49, 59]。由于 iOS 26 刚在 2025 年底发布，在 2026 年 7 月的市场渗透率无法达到 100%。遇到一台旧款 iPhone 或 Windows 电脑（截至2025尚未支持）[cite: 64]，整个去中心化愿景立刻破产。
2.  **OS 后台生命周期依然存在玄学**：尽管协议层面支持低功耗，但 iOS 内存管理（OOM）仍可能随时杀掉退至后台的应用程序，导致节点物理掉线 [cite: 35]。

#### 方案 B：传统纯近场架构 —— MultipeerConnectivity / BLE Mesh
**致命缺陷**：
这在 20 人场景中**已被判死刑**。iOS 系统的 `MultipeerConnectivity` 明确限制单个会话最大节点数为 8 个（含自身）[cite: 42, 43, 44, 45, 46]。若使用纯 BLE 广播网，在设备锁屏退居后台后，iOS 强制将 UUID 混淆至 Overflow Area，不仅发现率断崖式下跌，哈希碰撞也会导致应用层根本无法区分这 20 个人是谁 [cite: 35, 37]。

#### 方案 C：混合架构 —— 近场动态 BLE 信标 + 云端时空匹配（当前最优解）
**技术机制**：
这是 2026 年大型商业应用唯一能保证 99.9% 连通率的做法。
1.  **发现阶段（近场握手）**：Agent 应用生成一串随时间滚动的临时 ID。应用利用 BLE 发送该广播。即使退到后台，只要周围活跃设备捕获到了某种环境波动或临时身份映射。
2.  **数据交换阶段（云端接管）**：每台设备的 Agent 在云端注册了自己的 GPS 粗坐标与网络状态。当用户走进房间，其云端实例上报进入动作。云端基于位置栅栏（Geofencing）和近场设备间捕获到的模糊 BLE 信号强度（RSSI），在服务器内存中建立这 20 个人的「逻辑虚拟房间」。
3.  **结构化交换**：所有 20 个 Agent 在云端相互通信，秒级下载对方的结构化信息 [cite: 14]。
**致命缺陷**：
对蜂窝/无线网络的强依赖。一旦 20 个人身处无网络覆盖的沙漠，整个 Agent 网络将彻底瘫痪 [cite: 15]。

**进阶挑战：相邻房间的物理隔离边界问题 (Indoor Room Isolation)**
在混合云端架构下，由于云端 GPS 缺乏精确的室内水平/垂直分辨率，且 BLE RSSI 在现实反射中极度不稳定，如果两个独立的 20 人团队在同一楼层的相邻会议室，云端极易发生「地理围栏交叉溢出」，将两组毫不相干的人拉入同一个逻辑房间。
**隔离锚点机制（必需组件）**：为了防止该现象，系统必须在逻辑层加入一层强制「物理共同体验证」。实际工程中可采用超声波环境 Token（Acoustic Token，由于声音无法穿墙，所有在同一密闭房间内的麦克风都能接收到相同的非感知频段动态高频声波令牌以作验证），或要求各设备比对所连接/扫描到的本地路由器（Wi-Fi BSSID）签名组合，甚至采用用户发起的静态 QR/PIN 码确认，来完成云端虚拟房间与物理实体房间的最终绝对锚定 [cite: 31]。





### 5.4 结论与最终技术选型建议

针对 2026 年 7 月的现状，必须在双平台实现极其稳定、大规模并发交互，建议采用**「云端主导，NAN 兜底，物理锚定隔离」的三层降级架构**：

1.  **默认层（云端虚拟空间 + 物理锚点）**：采用 BLE 广播进行临近感知，辅以室内超声波 Token 或 BSSID 验证以隔绝相邻房间干扰，最终利用 5G/Wi-Fi 在云端组建 20 人逻辑房间完成 Agent 数据交换。这是当前绕开 iOS/Android 各类杀后台、限制并发断流机制的唯一确定性工程捷径。
2.  **离线降级层（Wi-Fi Aware）**：检测到彻底无网（如地下车库）时，Agent 自动调用 Android 原生及 iOS 26 的 `Wi-Fi Aware API`。在该模式下提示用户保持应用前台，通过 Wi-Fi NAN 集群实现 20 人的高速去中心化结构数据分发 [cite: 49, 59]。
3.  **空间增强层（UWB）**：如果 20 人的结构化信息交换完毕后，还需要进一步判断「这 20 个人谁分别坐在我的左前、右后方」，则在已经建立的云端或 Wi-Fi Aware 链路上，定向下发对方的 UWB 测距会话参数，唤起 U1/U2 或 Android FiRa 芯片进行精准空间定向 [cite: 22, 65]。但必须通过 UI 限定此功能为「用户点击特定头像时单对单或极小规模按需开启」，决不可作为前置的无差别群体扫描协议，以此彻底规避严重的功耗灾难与射频拥堵。

**Sources:**
1. [163.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHgv08c5RvMQh_2QlcTkhw_eezCJX9glnTvrUFa9i-1BApW4TrPfllVgHMskRri2OJW9O_g_gEQ47s5PPyWU-Rmfo2LGGm82s0AUFNluQgLGE5NcB4mk3q_oTUnM5ba_cqXrZZevLmuWlOU)
2. [tolkiana.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFrkyDTfDpamTNHQValHY-S2tSkrLo22FGLMR84WXIxWUBLV5mbR0JHfpe7E6K-duLnP6QO2rliGrlS_bUBxPjRHfkFoXrXGF_auo24rmSXp0BH0WxQ3FZK3YjAra7c_7gNTdc=)
3. [stackoverflow.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHwnrFBPkuFu828FmNUvCQYCp95WwytE2JBWPp1y0kaKIWjRbGgYKY8G5ZG3HkwBeHNtxzSQRUuS5m2rLsc7J8j_7Up90ydUXSES_HVlnDslFs-oKh8S5UDzq1-6NK7LZzMlothsiNwhPfjkaIWBp5O1G84z5godyBxFtRxBIWvP3kH1jtV9Us=)
4. [stackexchange.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFsLox_8OJqSW4VMkVeOrl4cllnmpmaGwpmToNvGJfcBFV_oURBC10COzX9I9_1sAgYdGi5C_RHCk-k0LglygS-AU1eyM0FL4zgyqSrxyNLCWpzA9eS10_daxphO5z-N3vT-1mm_RbvgqQTL312c6iwaCSooyvkVRO9VGNDAhef4fCi7PpzfAEtefhttvZYYAttW7ZQMEuiFcxOmHZh)
5. [apple.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFGzP2y52uZOSI2RSfA9kB-Cs8OKwATNW8jqa9OkklOyJW0nHPsW6gCNC46pc20aYPeBZoHaf0YHLZNhQ2jS3DgrkpwNRUSP6nAlno0HXxDeCGIQcLeW6OKcd8IqweqpiODz7zScO3v)
6. [daringfireball.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEEpVynonGT_E4NpFoh7cR4g99t4uKTxeevwDoXuCD6Cr8U7Nga1Bq1CiD-QgaG3oQLf1M6ESLR4oJnEBuUmbTgz-u2WbwtOmK0Ev5xO2gAyNl5H9hwTUgKlDvB1jpMhi8fUkooDHgdBTRXw3Ph4731LbBeV7GV)
7. [macworld.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFGLE36gk33FIf1oW5xuOGHaU7QBce1f5boeSLBW_1xdz6BxOsuZnNpGudGKCWUt_3zdp8osrh0yG5tVJtNBxpgXH01rGhp4POGCt7Ll6Y4HXK_UbSyhVI6JlD9Q3oEybcQnjrRiiqIM63oVoXBOcs-4C9LJ7Wm2UHALl-z2m08G3OEd5QLAFixKqYV2jIvoFo2XoMi7Q-e6eK9oGCxUsrDUHQZUP9V4vJY2N7Sa93qOCR4Ros=)
8. [apple.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQERadNJiV0WwLAUY5WWWOG-UztXOxaTX9VJkLkc5BRptx9dORMeoziHcxjG37jy30OXKlQKaCzCmvw0mjRO4gz4hPe7Ks7YBLjY0pp__eu_QDaN0qTgG_-qC_EtEvFCa7SSAuUmDJ_0UCG8B-Dc74vcm3d3Y14V36epMUFB0xkUYIiLJVU8_5iBGFnW3vP8D3JfV20HOFRDbMrFS7WPcVT8ebkFUpghapw=)
9. [appleinsider.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHhLadYJsKQziTf_MH_9UqMRjR5-Szhc4QW-Pb5ZabcAMPlvgkqU-wUKlRv3Fh8I-d9uElJEz7GxhRMZeIOSCL7lLf5cTOeIjK4KV3rSEtmiP8wgJxTNrPfiXfkXC3E1AdVn7ahNGD0N4o4TqkAVsdw5pf142EQ9TuQI1d0BGZtPxi2qDvNsL_rx2BFxHC8COSqMTG9e9d0SNo=)
10. [rfidjournal.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHrKN32rMw0FlE7SaROZhoN3ldbdeYd4Cv9I2w3gUAwOlGiXzCCj32Wfux08Ita5JboCBk_npnhtT63DE8aS5Vy76COIR92JKDT-aOYBkr8jwwpVAgyevVf8Wd0EJUyjCbzgNmwflQw9yVaKfdhI6mabUSgSkEJD75kB1rKNJnNGVTXKNrx)
11. [android.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH2wXAB66cbD2zSkFXbWb0OiL_4vD0l5ZLd0Ifq71_a21YFE1OSTZ71vhH0hmgHcZY-fKZcP-SSlDYLxl3lZk646i1h0s__EIpAJPgZ_UVgxJHBmadw7ysInsWTCyunJhYxW6HGPYWQC-YRRybZXB24)
12. [pcc.edu](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG7xMc9dx-S1ykxewV6lw93pdtlRmOngT4Ya-JmNokvp0vmU9oylfS2h7S3pkPqE60EqlV6mftNAH8bcOubuigBqIWc5UABvCKVAxj3ptuse_Vfk4GdmzAWS3rtIScj-1LvHyE7onn0bUi8yDpbY8Fo4fqPFBXCAuKMvCKNzR_xXNk3AsldG-hELnPe-64Zjn4d)
13. [androidauthority.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFd4bpzcO11TobnlMYMveh0Lnl9YoZVnB5bCN_VDLTYl0LBLvabPh4vuzYbhq_bzeEHXUIkXXNIY_8qUJyPE5di6lVlirGnjCRQuQd1gOy6hXVHtIZTaxjrSlIj7l0dHLotl311gJxxDhDn9oJRqJvavd0cYJg2ew5MGRRRy3FA8Ee8yGolkuQ=)
14. [sina.com.cn](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFw20nmTpKOXn2rrlwKe3X5Lil2XaAkrLYFETcfSWbrawp22Gqao7Npaaz137zhW4aNhM4Y_OF9ZlH2MNzGHCkmIqUCHbZsweNPenTLKgXMr4UjygiuJHgZNG-oyu1ZQwmwaH3xb8BckrcjiUWn_eRgMc-jmoYZKTRSQPc=)
15. [qq.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEoDKsfpLG8WJ13Xpi-1LMp5QLr15ChmgqTIG-wpYPD79BJs8I3psAVqgmOt0SG1x3kdO6OG1AaeTnr_Vav4_eq9cdlKG1wU9C1fMDRRSfY5paHtZFFCTy6-PJr594OGz5K)
16. [thepaper.cn](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH8gxRbKefk1WG8oVVhOrnAziQT9thnypVY5cofmHbA0FkacVXsg9RNHtJSaFT9r49GkfB5kWaFjN66n-WZBKL8zcHPmfcEo5K4Ezs_7Obx3O93AeKEbg6wmQsHsUNm3HhnWL4CyjW1)
17. [csdn.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHDj68sayQC2gpi1kslS7G_PZN_gyziqgabVB3rdbclXDTGIR97Dh1tE-tViXvOOWh4XaN75qzFkjlsm0xe-FUJJMFDoBy0m8cvKR1MNTknwT1brQbHQjaH9kXrRkJny_e9FwLOOP__ptAW)
18. [csdn.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpvG50Tc3HupB4JDuje4g_lh6g3WHhkjbB3CBwR21BKBO0cmf8g92k7v2u4UWoHRmuywLu8GAnL14MhI9KUsiQpl0g5j3h3BT90CU6YrR8wzDfhLDSyf-wNPJfCcusBd6HpahSyLJf7yKlI0vuCzGOtw==)
19. [csdn.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHzZJcs8hy-68zSU-f-LKAyHHEZIJhgcxUzikbzeq3QuiYWhwwUIPitBK4NeFQJc9wyQuocgseaRFQnWUEEs6Thi1t5QeQ-pQuRyiwbyLPJb2jTeWD_Y2xMtxh2abcKQJ2WZ0nb1YGDQ0Rjs6yRdUQY4g==)
20. [9to5mac.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGwY-czKIIn7iFtJ5owSyGBaAA4576gKUpkE_rb6uxgDnntfyd_h-agguyX8mBwOkMRI5aRxswV-U_8B8WgMUwCoaLqKvz7aMUXwWwWoBVU7DLCfWrS5fVcgRGhTxYsf7Vm8-T4bNl7OE5Z4UtNhj-DYo0FFSa1XX21-36Q)
21. [imore.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGsoHFMuls-9nl1lgiL0EcQ1hI9OV8SQCQFG2jPyQGIoer0tJ99h2l08dsh6mU8jOCK3ck7E9-cgYe9xtb9CFFlZGHaZHeh-16uS6QtKZvK__rTVfC7SDnPsPo2kFhKtgijdKMzHJxkPktf2y_rvay5ghU2RtHNgxvy_Gg3uDYetOGqxaLUKiDUV57SqwY=)
22. [apple.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFUCdrPeEtQr8iLjMEtDZGkNm73wPHBQ2XbzpInFQUKq6AEP6Wyu9aZi8sZAoKTeOc3pzjkgg7BKOxbl6Bh17MkunqiRLP7klLUy2ijXX4sx-ZhYl0xdtvE_ghDR7XtTPtExC3l-64JlJvkS9AHzrkVf3OBMqREusVI9IPal0sKBVkZ3DAm-2Pgfb4eoodyslUeUGfdDAjpCn0R1Wl_HT88ciA=)
23. [apple.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHY79aHasTar2QJl_DkD4ctDYD7W8gkJYO7NfBVCgFl1DZc6uOsSkwmhfFvg2vTNOcsJjqTxoZcerdZ5y1W9Bvhmec8HBVeRu5ZxaX06ldpao1AEr3N33ZhazJdF9wxDBVmGuIaOR_21BDZp4abfmut)
24. [symmetryelectronics.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEHZunrqbtyhHCfF6PjFsLtWs2lXjCpUHoRkR1WwdK7dL94JZV-nVTsGR3PDcwomk1RjuPXQI99Cyg89-HTR3wKHUaeF9cROUgPvmTSqjupaN8JbNd6W5It1c24GO6FCha9UyLzfNiUcGZK9Ru-FzBr5HZsHR2FcyRGKRiiqitcc-zU3Gy17yl0Z_Vg7JdSqg==)
25. [matteralpha.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEz6ftu2ieA1833blWi8gdlzFzSDdoLVjkq2-1VEl1qIZwWPsJy2Lqy8roaofv_Fpn8u0OSof80wDruQG6Z301dktXmqTKfVLQXPhkeoiIAQiu8uU-Wu4gSXWu1d0w3pgTA3m2h11GafIA81UG36ts_MJbxwnAAnwdIdlH52h3W8zwsduLkaFo=)
26. [microsoft.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHIeXalppvpAVvo3t899pvxPX2JE_ftcjb7M_HMKy2RBiNWvPhBZhDWVPHv-ObsDa7O6HRz0hShuUzD57nw7o0H191j6lM5AcexQ058jRSt3aqkbrM_yxXwbiMKBSAF3BcqWyssUIBAtHC4yYzA2bkWSfrkQL5oYiI5BiLusgfdlT4hdCRRCXXPZms6OHpeGveIBqN0_7OYtvXdV54OPMcUYfsujz6-N1uC4SH_g778dBMp)
27. [android.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGPt70mTZPFqqcUHUwXbRBbEactGiLzSt2sYVAmZTucPLYxHmfSKFz2t0Xbc3HHH4NicdRX6WJtqb5uKnNM3A7uVWuhVD-O58ZIo12MrSbbrzE4SavLCIwZfGnd0Oq9q90bQ4reb7yUxGdiI6uR067olRjvXrgaozy54oh2gr0BIf_2)
28. [android.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH5VFzNh5QX31U7m0Y4WP9dYlUBp_n71zV7tIO9DTogZQo0xQRw0uLq39J7yb7wQjxFJSvS1IOAvwgv794ryxJcuYDFGye8FQTkDD1GwgAXnQchqps6Dw1LmH0vXAah0m5HJbI86-E_6TAYkqqr1e0eUP_gb3F7LEOMdg-M)
29. [ditto.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFvx-7HoE9Kdk5mxBtBBQ0jYKv4j12lW5Fa_Qq1hVVLM4Qh50NuHd2u65FQakJ203Nffdw-DuwTyKB5H75EqDV_S3LOyMlpEfdIaI_G7e1VAek9MLx4N3Jcc1_NyZxMjAvIuF3pB1fwmFTKzRYrbOHXCuB6FuTlvUV6ayfG9QeIuA==)
30. [pub.ro](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFFJOP9Pn_hcXMc2yifU8Kh6qN-PZXxoTlYcdEria6wUkRHG5Z1DPv4wnFNkOKjE5D4phh_6t95ofb1DiIt5ikkdMZpcikCK5etFFv034UtYVYl4WpNV-hg1wV1qmP86uTghWf4Rqz9-RMeEFvFHcKa9owIDxjCkwu0FxtUFem_ovATzgWbFphDEg==)
31. [researchgate.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFKEayjsR0-yRLVe855f3z7Jxj42kqAqkRKueCtFnAIZVNmUBODaNJXaEgjoPB71CxdTK3O4Bh-8aCHxg6pdR7j3pCb9JK-SOTPNEhbpAnTtUt2kj7XVSVQ7Jvy4Fo5Hs0Jhm8mitQt1kkYHSSObZDs83ZHNoBCr1rx9fs5cTT8bktCjWo8iL64wNkRlq1piumDSfmNkPd96u7Pv_EPGoXf5agS7vCfCyDv2lq-ZCFBEE_Hb93kKzSQBZ0gJRZgYWjrc5g3LInvpGkpYeUatBGFZQ==)
32. [tuni.fi](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH3yEyWKM1_jMufvq-a7ke7UvzoCborD_DEIkkOTqnX6DODi271VKA1XrDvoXQ_vf7DvkPdV4NIWm4q2FjOFKqwEfb-AUt1LrxFECjgMznJesXP5BGRAR567pkpZmSKcujgbJH8n84wzScHyq7DP5d0ce_59Wt1eKFwcv4JRGVtlNuuwudRwA0aD-rzHJFCDtDDbQPxJp8=)
33. [researchgate.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGOLrd14d4GKOk6wcQOvCpHsIXumujmlBynuQWo-Z_gNVbg4hVotzFnutd9MNNzzjf0jpNa4ZH6f6NlhV8Vdq6NKVRSie2yXL9JB0bzPm2jjkZSahgx_SFGr-39j3HXRVdCvSFkt_0NWgx1989SoIrgUQjZoBME-XxlU-hzRduKpZ281bcHupQ8OwF6UYzax9nCtt891a-ae9pvaF1QFdE0cZWxrd0=)
34. [github.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHLEoZsPIOBRv1uOTWNV54wKkpjFoRizGArjeoTmkP8daI656gEqSSFyXAz4cK9xryuxe4RMX84abEwL2uZfP3yEV4p0M9ul68OeGm2sxRTgtF74gxUMFZL4VpN17HqzdMs1mrrmY0=)
35. [apple.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF3NOijH_zl0IDREkLO79TjAe7EMFeePoBS_DMHCQpzWdU1zI5qc9Z8hgH4uJatG9-lXi8A5oXggymF8UYRS9iFBnjalz0ZLS-uUv1OajEYkENY_W5h7Es_o6enPiaXAHZ3ED9HVV7Y2x8jM3XUtyG1ojK03fqdehNWMERQsdKFO9CxhtRVIZyHwhSraOAkSzoudfqCYiLQfKwcCTUIQUuaK6mb9jz2qNTmXehzSh08Su9bfsM98N0edciLm0g7m-SkJ1wKhWZXwVJoRn48_zbBB8mutz5M48ACfAepo5O6B5Os4m0-478nRYlIZKzIX0UWDdOTln2h4sUi5dZtKcWbOhU14dCZ)
36. [stackoverflow.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFMSh5QJXWjll7oeYyvosEJd-j9T29O4wCjwQupcuFUIrJenm6mOVKZy9KyAc44scb-1ouWilTKKtTggZHfpqN0yHar47SspZW4V11qv_58zqcGjNnqPgyNUd7aeZbk1-k8XIS2l3FEyv2iWOTA1_RPJfLtV0PTvB0Um20jWelI2YaUE8ZTPUXQXcRtvVYs95wM7Emh)
37. [stackoverflow.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGAMzhuhrBfnfUfYndS3SuiWvhLjXmjbERF5fBdWqjGqJaCJoloh9sQRQSAbXpVttqqmd-zExuFPov35yjMOGlHJwe7lwrKaRZKckXfmMKyikW1Y9GebRtgNZistlwgTikdjEPAPkQeVs6VuDMB7XUKG2K4zQ2OK5ZhO-SLMoVspfgd3LIe4lTCaIPN72AVbEOwrLzRYdnAZkHw)
38. [davidgyoungtech.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGZLPyUYVdkYTrK6kQOlipEu820RI5vT8VYYDEfLL5O8D0Zs1Ezdpsd-ZCZJP56KQ0atq3mE1RcskJNk6P7JcWgB40G7U_n8FoF4z9JwfMCY4krfLj36HEy28XqbimN5UB4AlKHG-T0yox2AGC0OV-rgztayO5-)
39. [punchthrough.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH4NIUHzKhuib8ui16KvuZHmM6Bf47xZ8pWhxaMZG77YVqELOWtdifXpJH1Fh61HtEQrLYTCuW_W3NH3iIXumJ8jiumbGkFaQLKlMCX5Q4XtVHciso-7y0v42s98JE2ZcqqMEVDxFuvW4CQLypsgKk=)
40. [punchthrough.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHGEBpd_A_LvddPwEEeK2cVG1EI0C_JZItlV1vLOqpv8ZqgWnihMXT5thk25kw7FuejIDgnUTp7eTyIWXBwKSNlTTMUXwOyjV3g_t-wbMVnsEmG4hylRWxeL9-FZ7GJttbiI51n75g=)
41. [zco.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHZmpa25gQ3UfsUsRPRTW-yE9iT-tbSkcFEt01hEgBU5epNCcyL3o-DE-11-oJIAtZidYDneCXL2k5sBxbw_t2u59fL0joC9WwbgnnEswUJnLMCnXv-dhQdjSq0jQ1ft6cq2r0Yaw5aPZMlJwdtyLOSWQw5HGBtjt5sRAxFYII=)
42. [stackoverflow.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH3XALyYll_Vo7HI6ZA1qXga0azjuwTBGL3axelNs7U24do1J-JLGulwmhJKmVSzNjhb1GTajjY-n6Msa7h0h5H6uYwzXtHhXS-IIkmSB1fBwe_zU1OlZVEYNPmUHAk_FazDEmLlQA_wocK5QHAU4Cslu_4Bhb5kFNgRfJCGO35ZCkSzI0VwPED_ZWYIj3e0ydqWTAuHudat_R2PTNYjsTImBC65QoCnrZ954OgLGM=)
43. [stackoverflow.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQElao_C5HhOL4bdFEZMOtUmnPM11RlE6dpcZrzYKR4NBrrCAtovaf6qu1rEuWJK_Xsh3TIWCvgoR6wtSAd3Wb0FeSL0g5HGh44ezs6cHncTVYgyTqNhRX11isP4Q0nKas3hDK8jK-QweCg3gPk-QeOVXPOWQSDBeoYLIOMIB-if32CrFTPtpFN2zt0xJ0ELakrY7jgJOopCyQ==)
44. [apple.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGUVuYJCMJkTCzn7AlhlGIGu4ElZeh_0AkeFBanFpP_4xM_wXpi1aaWifyJfqFm_m4sBOXBPM_msSlmqlZEtpxRfNhEPUaFsOoWM-dvjsEkowLLvRfs2LpVtAAdCyGXy3slPEmVq7TQQYF92LwYqNlmJRwawPwCbg0tJz4M5BcS)
45. [gabrielhauber.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEcDpahZM8uJspmGsr5e7cVjtwGjTN9T6tFTMN01Slmu1WueqG60sDXpuahQS9uGc1TfoL65ktjrjFIezhfvUbQ8gJdULveWB5UA98JJG_oS8rdYxAsltTRebipNpWNJPNo9gsgfXsU61fdN5ECSS3Oo1MVSH8=)
46. [objc.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEN4eJAKJGgYAMt-t4H9kjbatHVMxKB6zkzLlGtU35wiR6d6ctKxOKzL9AOr6HU-jPuM4IuS898Zc65NODbyV4fApl29rM0Dm1s1kvLt92OqV1Q6g-QU_qzIv0FCwnThU6CEmRxzQ3WET1GI1yMHIrW2seP5ocsN3wRpw==)
47. [ycombinator.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHjQbO8nQ-Vg_TISZphuvISEQPxjqB0PjqyoXHRLZEkDiuaRcEuo22wudYf18Dclq8JSxH0v-7Ke4jcdRxoCX7-MTMCeICMaSWk0XE0dXEQzYRLyeCFE57bHr8Yc4R1ZLEHKpc=)
48. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGxP9gF2eWk1mMBUxXe3Qc4HFj9o-b9QnRZv_kwXDTn84FJfIsOhpkkqbZKuCur4avQIdMwJ0F1eGlcIjco7SOGHgELRvoKHW6vZpFh69aNDCGWXWW1blr7iFJoapR4Z-7ob5xjbPzFa4JcTwx5hE_M3v2f7s3-jPuC9-O_ZfNr4V3f-qrSU2LG0mU54izRdcKIOuXH8BwzEb4gWge_NmZ1VOPWrsuB)
49. [apple.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH_RU4w5aaWYnJRrY6oXxpZo0Tt4z0Axl8ld4yyUSUDNT39246PhiQ_cUvXtxJvQtNgS0tATYRn9fE4myuEhOFD7DqW9LqdEF9NNqCghP5FXBFHmSeFrYzBik9bcciXAb86G8KFHaW5m5Q=)
50. [note.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEGgysQYsoxJ2VIlXzZUColOmHjWGd-9aUsC_TCSWhljCFN5IjhOb8d_FJRX6_HFjrXhTZdDzEfjMAZbPNmtikBLybitlipg5anA6pww8SdJw_k2HGxnwE-Jmp6kKOGrDOmlw36)
51. [sina.cn](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF1UXJMVWtxv9CV3-jJa9TYyh654ca_O2sG9uEV2SPo4JP6EbqzArhkQ7rRpTQKt-Igyuc0jf0PoqTHxBOAOJmjTl879VrjXgDzGuMdHMPUyrM7LJq2Su2EYVxkpB93qpvZth2QDoejbTUWxq9UdWGfmT6ua7y_tThHdDx2cQ==)
52. [tmtpost.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE0oNjd1Hp6Df7QRSTYkB36OgXmWj4GIlI5eRdONxt6STC2xbZYw0OwR4dpqHHhS7HSdK1mtHw3tUN-yuq8jlOG-UnpYm43sibM5PPQiONSss_E9srmStKAhjU=)
53. [phonearena.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFTuh32tlhnwBnC-jdFtruQFB2uwNMjgoj5nCGsAgNyqVFJlLE06THxHd_BeypBv2SAjaX2edLEXmZryOzRHunEhGCTUIwkBYio9m2XvuhtHMm94M0VKB8BaFfy03odeh8Ytf2O7Oh1f6g6EXUUVGDb5a7wzcoGJv8abXkvNjn-X7xiiKcJLUici5lSbbVUgUAiIvlvMuld3ij5xcQH6Sk=)
54. [techradar.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGUhROMdQbMunDKUOE5BwMKqd4Ks6I0N69vxTx7YbifPIEyjyVZVb23SAsi3y9x_q5l2zuFBpOAtdiHJn4g-HuXTOLdyf19k0AzQZeulCyQQibkzBT80EIOo6nj_TPk2pYfP0Bp5cG-cTy6JZVnHKdxvDHoW5xezL3-AOt_bpmrn0PDDwqB91WffhVMePo9SqqVqCsmNZZ-vYBJlNU=)
55. [qq.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF8x7LThgcprataapAGl5Q4WVZ0yUIZZplDlEcy8xpmra0pK8nkyt7IpypnuFfxQdT4nFLsr-yqqGQOTLh-XuCtwzbR-Ws3tnlMcJH7YGitelzPUUUBNQ-XZ1bvfN5RbMNe)
56. [samsung.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHzBpxs6aW-JIOY8e7tAmJfGh3ITMoTf9eHgzyAuHKromkPDYsXaBqxGocSe2kIROBPCp_lHmnKM_hIa9Q6_ZmwAzJjF4VNsrUgU9lNjiaXLSk9xEeENXITswP68qZtFyX0_b6K03Ru-RDakN7IyzM5kfRsZ0XMTUaE1kG8BH0Hcr0xH1pbEW97ewRoyMRnxmK2WebK5k2Jj8T78NaND4NHnjiGfjHvVL5b9llSyUs=)
57. [samsung.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG2aEr98MDYDIMzm4be4inqkEkReqiY_EomYBT1-UhGARtP0IVP-cXIaYXWlIDNFk3rllCr5ikWhOJjKL_VLLcES5zGfD-edVUxPvfBAjyckw2UG9ONf9DN59Ic9Mce1K56vME5ssRdLhvLdRRafSu-f0-OrQK_4nyL7DbaN195JILJBTVMF7PYVNxQ0TKJlXSTPW-PlprCJ_nHRF4WUlIYr6QsvFFk-0dcc__i)
58. [pocketnow.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEIbR0ARimEH1rYi2jhhcoD-rw6qkJm61SaIKDWrtdmQ6wRstC6DYc3UpfkX4yTSE1bLVFGji0FT1M4py0Sg5eNAcUjJC8Md2TFZcSOtI_IfW210FuZeEiWMLoElW0G3cWUt7hFFuYdDZwo7rNG4LUUURKavID6tSxNVriOsgwPgVsm_oAFOdYjC99_t_GKols4JHcn0qg5)
59. [europa.eu](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH970qkvQGZdLUC0tyIe_QWbvgg2V9rqQIDRbZeOOZbM_sTKURkfr8wVGrPHWmeTcvSWkq20tuQKQ8rw5Byo_KBC1UF3xfr6tM0n8jM2XvAGlt6j1n3Ldz7JJsakOHzSDwT8KbuDCIUuqHr2TpKPb_meyvlo6i3Qq_r25JySP7YiDMU9X7yxMIJcDL8O3o1gI0-Z2Uzeik2EWmVwpDw9xWoFZGRtZUHUrqQ8gz-Zrz-ojiy0gLhAXR1JONPfenppASn8TgbCOXDqGOQquA=)
60. [wikipedia.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQERlIQD7z54SdGlPPNRSYuMqdmsWEeAW2xaHKWYbuJkpNBYhiEQnx0ZeNDaSLdcAnDaQRGWIJoO3akurbtjqvSUsQ0_FOHzyQZWyVxVBQ9VJ5S8Oumv8aQoaDw=)
61. [open-web-advocacy.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQESNcofUe4krQLzSz2hZi0-QIf6imPguYrR_TZs-rMkwEodfLjcfGhM5NWhtSl_W2Pl4pYXotjT2Y8LoDljqicIxNCaXF8G0NgZb_InjLltFVaBxJvbcy5OAbo6stjc9kNpAp6NUJI3P3iT_VuP1ooJ45fpBfTNFvzUyEHhlQpo5a2YErbdGfkFLBtkdcCg-vb0XMgQJBW20vm2wGsoqEdUH4wIx3tMUgc4)
62. [realmcu.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGVGcyLksuLni39xfGE8CtvMXjdev6XT-pnWglBMx5JXDiLW4eDZvrkS0vtrNaHXCFKwJ_wW-cQpPsm_PXLKb94qvbfv6evyEemcQdwdt3GTekmsrCvo7n9hDbKAM4bbWaI-Fk=)
63. [apple.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF3LDKDCFYxYfVCDM9SFiiFY4kTwtll4At6dIrsNIinluwzgyPI9R1htEDrDDBOI71O05V3-GEwY-2V21eOrv0e4-mx_j_EgFh4r5oUdKbbRDD-QIjcSm5o2RijoFgYix3zWHZI0H6PB1RnOXa-J-9mXqEedNUjZK8GYNh9CofZSB0HXDLIGHempd3-sISbCyC3nx0DNMC--p0smg==)
64. [microsoft.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF_vwmIM35KMBqAOrks9mBvR-bj4CBg8pVujWVPr0P9l10gfOKGCEVO7sRAyYufP7oHeskzPNdVV342jr6flS6VJ70ffYg6J4i4tffN9pMAaX_fRgyt0prtCrLziO-Lfpjy5ZFa5nxKs0HlyjCnTw76peP84tefMQcbcrDGMAW3OkWcESrmDxSO9BcG5m-aOjych6_MhtcJN0ie-8yE4TY=)
65. [nxp.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGTaClNHXcnDNo5RiK4b5IarQl4Tb_tnnsHalqdfs8yNy_lfM-phnBCd2ZdqWaM4V7X0FiqjcY6vF4QqnmVOaZIfXN7TRJTcUmcVNuIlAsNVr6CHwBpmj-j7dZ7vUtGJ3cYqSdqbpZ5QVb4baYldLBHlYB1-u7S7x-5UFbmucYBGaj-Z0Ci1rib)
