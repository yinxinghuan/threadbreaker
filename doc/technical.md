# Threadbreaker 技术文档

## 1. 技术栈

- TypeScript 5、Canvas 2D、DOM/CSS、Pointer Events、Vite 6；无运行时依赖。
- `vite.config.ts` 使用 `base:'./'`，构建资源为相对路径。
- 权威模拟采用 `1/120s` 固定步长；Canvas 只读取状态渲染，不反向参与碰撞。
- 正式版通过共享 runtime 接入 Aigram 身份、Top 50 排行榜、永久 UUID、海报与 guest shell；平台外诚实降级。正式 GPU 粒子技能仍未声明集成。
- 排行榜 session_id 为永久 UUID `b9ea9b06-16fe-4b0c-aa9f-0927fd604080`。

## 2. 目录结构

- `src/core.ts`：纯确定性模型、链片移动/下压/拆分、障碍、射击、碰撞与离散 route curl。
- `src/main.ts`：RAF 累加器、Pointer 捕获、DOM 状态、Canvas 绘制、暂停/离屏生命周期与 QA 接口。
- `src/audio.ts`：真实手势解锁、程序化事件音、8 voice stealing、压缩/总增益、静音持久化和节点清理。
- `src/inspection.ts`：冻结终局巡检快照、生成匿名任务号与建议；旧热敏 Canvas 绘制函数保留为改造前证据，但用户可见结果不再调用。
- `src/i18n.ts`：宿主 → query → `game_locale` → `navigator.language` → 英文的单语言选择。
- `src/style.css` / `src/narrow.css`：视觉系统、全屏适配、44px 控件与窄屏规则。
- `tests/core.test.ts`：30/60fps 权威一致、路线确定性、链体拆分、安全带约束。
- `tests/world-layer.test.ts`：锁定 `src/core.ts` SHA-256，并验证同一终局快照与任务号完全确定。
- `_qa/capture.mjs`：真实 CDP touch 路径、touchCancel、双语言/双尺寸与全状态截图。
- `public/THIRD_PARTY_NOTICES.txt`：声明本版不含第三方运行时代码/素材，也未捆绑正式 GPU curl 实现。
- `worker/index.js`：自托管部署所需的 frontend-only handler；仅提供 `/api/health`，不创建第二套游戏后端或数据库。

## 3. 核心模块

- 状态机：`ready → playing ↔ paused → cleared | overrun → restart`。失焦/隐藏只会从 playing 进入 paused；结果后重新创建带新 seed 的模型。
- 主循环：每次 RAF 将墙钟时间放入 accumulator，以 `FIXED_DT=1/120` 逐步调用 `step()`；渲染帧率不改变权威结果。
- Centipede：每条 `Chain` 保存有序链节、方向和速度倍率；中段命中将其切成两个实体，后片反向，双方速度乘 `1.08`。
- 路线场：`routeCurl()` 对 seed、网格位置和 3 秒时间桶做确定性散列差分，权威决定障碍转向，渲染使用同一函数画短线箭头。它不是正式 `curl-noise-spirit-field` 的 4D simplex GPU 粒子模拟。
- 输入：Canvas 只接受一个 active pointer；down 同帧启动/定位，move 夹在安全带，up/cancel/lost capture 清空；无键盘与虚拟摇杆。
- i18n：任何时刻只渲染一种语言；刷新与重开不改变检测结果。
- 反馈观察器：`stepWithFeedback()` 在每次权威 `step()` 前后比对 segment/shot/chain/phase，只生成视觉标记与音频事件；不回写速度、碰撞、`routeCurl()` 或任何 core 参数。视觉数组上限 56。
- 音频：`ThreadbreakerAudio` 只在真实手势后创建 `AudioContext`，所有 Oscillator/BufferSource 进入 `master → DynamicsCompressor → destination`；同类事件限频，同时最多 8 voice，暂停、cancel、blur、重开统一 `stopAll()`。
- 静音：`threadbreaker_muted` 是唯一持久项；无身份、后端或平台存档。
- 摄像输入：进入 `cleared | overrun` 后，`freezeInspection()` 深拷贝只读终局数据；主界面按 phase/splits/segmentCount 选择 contained/residue/breach 本地媒体。媒体层不引用或写入 core，任务号仅由 seed 做稳定散列。
- 回传状态：`locking → evidence` 只属于 DOM 展示；正常模式 460ms 继电器/视频同步，reduced-motion 同帧进入 evidence。重开会丢弃快照和定时器。三张 1280×720 JPEG 总计约 504KB，按档位加载；旧隐藏 Canvas 不分配绘制工作。

## 4. 扩展点

- 调速度、波次、碰撞、分裂风险：`src/core.ts` 常量与 `step()/splitChain()`。
- 调权威路线：`src/core.ts::routeCurl()`；改动后必须重跑 30/60fps 和路线可读性测试。
- 正式接入 GPU spirit：新增独立 WebGL 层并严格使用 `curl-noise-spirit-field` 的 ping-pong、4D simplex derivative、float/half/unorm8 性能档和 MIT notice；不得替换当前权威状态。
- 调文案/语言优先级：`src/i18n.ts`；不允许双语并排。
- 调布局与视觉：`src/style.css`、`src/narrow.css` 和 `draw()`；Canvas 权威坐标保持 `360×640`。
- 调声音映射、限频、主音量与 voice 上限：`src/audio.ts`；不应把音频时钟传入 core。
- 调回传构图、建议或任务号格式：`src/inspection.ts`；不得从这里改 `Model` 或权威判定。
- 发布、UUID、身份、榜单、海报：平台代码位于 `src/identity.ts`、`src/leaderboard.js` 与 `src/shared/runtime/`；正式前端由同一 `dist/` 双部署，worker 只报告健康状态。
## 2026-08-01 结果显示层

结果层采用三行 Grid：频道标题、弹性摄像画面、操作。结果标题和三项遥测以绝对定位窄带覆盖在画面底缘；预置媒体保持权威结果映射，裁切仅为展示。CRT 光学层不接收输入，也不改变 Canvas 权威运动。
