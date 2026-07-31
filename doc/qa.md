# Threadbreaker QA

## 结论

**Keep / 发布候选通过**：成熟 Centipede 的横移/遇阻下压/中段打断骨架成立，单指位置决定自动火力线；分裂会生成反向且加速的新片段，确实改变目标优先级。用户已完成触屏复验，正式候选另通过 CRT 媒体、身份、排行榜和 external guest 检查。

## 重复审计

- `Circuit Serpent`：Snake / Light Cycle；玩家控制自身方向、增长并躲自身路径。Threadbreaker 是固定底部带射击、敌方链体下压和命中拆分，玩法骨架、输入和风险空间均不同。
- `Serpent Halo`：无失败的 8–12 秒 GPU 灵蛇拖珠感官玩具。重合仅是“分节生物”外形，本作有防线、射击、下压、拆分和失败。
- `Spirit Trace`：触控牵引 65,536 GPU curl 粒子穿印记。本作当前不复刻其视觉，只使用可读的确定性路线偏置；不会把灰盒路线冒充该正式技能。
- `Recoil Vector`：开火反冲即移动；本作是拖动定位、自动射击，不共享反冲移动骨架。

## 自动化证据

- `npm run test`：4/4 通过；同一固定输入时间线在 30fps 与 60fps 渲染调度下权威快照完全一致。
- 30 秒重玩门槛基线：静止炮塔的确定性模拟在 `30.858s` 清除全部链体，得到 `11260` 分、`3` 次真实拆分；单局落在要求的 30–60 秒区间。
- 中段命中：1 条 9 节链变成 2 条共 8 节片段，方向相反，`splits +1`。
- CDP 真实 touch：touchStart → touchMove 将炮塔从 `x=180` 移至 `x≈259.2` 并进入 playing；touchCancel 后 `inputActive:true → false`，游戏不误触重开。
- `390×844` / `320×568`、zh / en：ready、playing、paused、cleared、overrun 均已截图；`overflowX=0`，控制台错误 0。
- 暂停按钮两尺寸均 `44×44`；重开按钮 `164×48`；结果后重开回 `ready, elapsed=0`。
- 单语言：`?lang=zh` 只显示中文，`?lang=en` 只显示英文；英文窄屏 `THREADBREAKER` 已完整显示，无省略号。
- 构建：Vite build 通过；`dist/THIRD_PARTY_NOTICES.txt` 存在且非空；构建路径扫描无 `/` 开头的资源引用。

## 反馈层增强复验（2026-07-31）

- 权威未改：增强前后 `src/core.ts` SHA-256 均为 `1f61937fbfdbbc524bfc3eb6ef0da3db3e347ad079e8b063ea4285e2c122a920`；4/4 core tests 继续通过，30/60fps 权威快照一致。
- 视觉：链节裂纹只标记 `speedScale>1` 的断裂片段；流向刻线直接读取权威 `routeCurl()`；命中/断裂碎片、危险带脉冲和清波收束均在 main 的反馈数组中，不能写回 core，数组上限 56。
- 音频：真实触控前 `AudioContext=none`；首个 touch 后为 `running` 且 compressor 已连接。快速触发 20 次射击声时同类限频生效，voice 未超过 1；全局硬上限为 8。
- 生命周期：touchCancel 同步清理后 active voice 立即为 0（游戏继续时后续自动射击可合法产生新短音）；blur、暂停、重开后的 active voice 均为 0。静音刷新前后均为 `muted:true`，重新加载不会偷偷创建 AudioContext。
- 快速输入：连续 5 组真实 CDP touchStart/touchEnd 后 `inputActive:false`、phase 仍为 playing；focus 不会自动解暂停，保持 `paused` 且 active voice 为 0，必须由玩家明确点“继续”。
- 尺寸/语言：390×844 与 320×568 的 zh/en ready、playing、paused、cleared、overrun 已重截；`THREADBREAKER` 窄屏完整，页面 overflowX=0。声音按钮为 `56×44`（390）与 `52×44`（320），暂停 `44×44`，重开 `164×48`。
- reduced-motion：320×568 英文环境实测 media query 为 true，碎片不位移，关键裂纹/危险边界仍可读；证据为 `_qa/ui/en-320x568-reduced-motion-feedback.png`。
- 性能：四个尺寸/语言组合的 90 帧采样 median `8.3ms`、p95 `9.0–9.3ms`；控制台与 pageerror 均为 0，无 autoplay 警告。
- external guest：本地未发布合同刻意不加载 production guest-shell，因此此项为 N/A；`?guest=1` 独立访客回归无 banner、overflowX=0，且没有为不存在的访客栏修改主构图。正式化时再接 shell。

## 视觉复验

- 首轮发现：320×568 英文标题被截断、成功结果重复同义句、ready 教程压住第一条链。
- 修复：窄屏标题压到 11px/零额外字距、固定 118px 标题轨道且禁用省略；成功理由改为“少制造断裂争取高分”；窄屏教程提升到舞台 2%，链体下移至 `y=160/208`。
- 重截：`_qa/ui/en-320x568-ready.png` 与 `en-320x568-cleared.png` 证明标题完整、结果有可操作重玩理由；全套匹配截图位于 `_qa/ui/`。

## FIELD OPERATIONS DESK 回传复验（2026-07-31）

- 设计系统：遵循仓库级 `doc/field-operations-desk-design-system.md`；本作岗位为“远程基础设施污染控制”，与 Thrustline 的山脊相机、Chain Command 的地面观测站使用不同证据构图。
- 权威隔离：`src/core.ts` SHA-256 仍为 `1f61937fbfdbbc524bfc3eb6ef0da3db3e347ad079e8b063ea4285e2c122a920`；新增回传仅深拷贝终局快照，未改物理、波次、速度、碰撞、分数或 route curl。
- 结果映射：cleared 帧显示真实 `spawnedSegments - segmentCount` 收集量、残余链与拆分数；overrun 帧显示真实残余段坐标、方向、裂纹状态、危险带、`deepestX / maxDepth` 和玩家终位。两类画面结构不同。
- 语言 / 尺寸：zh/en × 390×844/320×568 的锁定、成功与失败均已截图；页面 `overflowX=0`。证据显示尺寸为 `354×201.6` 与 `284×161.7`，重开按钮为 `278×52` / `208×48`，声音按钮为 `56×44` / `52×44`。
- 动效 / 可访问性：标准模式 `460ms` 阶梯显影后静止；reduced-motion 实测直接进入 `returnState=evidence`。结果原因、坐标、印记与建议不依赖颜色或声音。
- 触控 / 生命周期：真实 CDP touchStart/move/end/cancel 通过；首次手势解锁音频，快速输入、pause、blur、focus、restart 均不残留节点；静音刷新持久。
- 性能 / 内存：四组 90 帧采样 p95 `9.6–9.9ms`；证据 Canvas backing store `720×410×4 = 1,180,800 bytes`，每局只在终局绘制一次；控制台、pageerror 与 autoplay warning 均为 0。
- external guest：未发布版本不装生产 guest-shell；`?guest=1` 独立访问回归无横向溢出，未为访客栏改变平台内主构图。

## 生命周期与可访问性

- pointercancel、lostpointercapture 清除拖动；自动化实测 blur 后阶段从 playing 变为 paused；hidden 使用同一路径，继续不会叠加计时。
- `prefers-reduced-motion` 取消碎片位移，不影响命中/危险信息；状态使用形状、线型和文字，不只靠颜色。
- 暂停 SVG 有 accessible name；焦点态可见；无 hover-only 行为；Canvas 与入口具备 iOS 长按防护。

## 待用户验证

- 真机拇指在 30–45 秒内是否能稳定选择“切头”与“切中段”，以及分裂加速是否产生公平的后悔点。
- 用户若确认 Keep，再决定是否把正式 `curl-noise-spirit-field` 作为 GPU 路线/链体层接入；未确认前不应增加粒子复杂度。

## CRT + 预置摄像媒体复验（2026-07-31）

- contained/residue/breach 分别由 cleared 低残余、cleared 高分裂/残余、overrun 确定性选择；媒体均为本地 1280×720 JPEG，无随机或运行时网络。
- zh/en × 390×844/320×568 READY 与三档结果截图位于 `_qa/ui/crt-thread-*`；`overflowX/Y=0`、媒体自然尺寸正确、console/pageerror=0。
- reduced-motion 直接显示静态摄像图且 `.crt-vsync` animation 为 none；光学层 pointer-transparent，真实触控仍能启动并拖动炮塔。
- `src/core.ts` SHA-256 仍为 `1f61937fbfdbbc524bfc3eb6ef0da3db3e347ad079e8b063ea4285e2c122a920`；6/6 确定性与结果隔离测试继续通过。
