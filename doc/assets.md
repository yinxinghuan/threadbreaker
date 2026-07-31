# Threadbreaker 结算媒体资产

生成日期：2026-07-31。生成方式：OpenAI 内置 `image_gen`，项目自制生成资产；无第三方图片、品牌、人物或运行时网络依赖。

| 槽位 | 最终文件 | 原始生成文件 | 权威映射 |
|---|---|---|---|
| contained | `public/media/thread-contained.jpg` | `_production/media/thread-contained-source.png` | cleared 且低残余/低分裂 |
| residue | `public/media/thread-residue.jpg` | `_production/media/thread-residue-source.png` | cleared 且 `splits ≥ 4` 或残余片段 > 8 |
| breach | `public/media/thread-breach.jpg` | `_production/media/thread-breach-source.png` | overrun / collision |

三张均为同一 1988–1994 年封闭管道巡检机位：污染被捕获、玻璃陷阱残余增多、密封破裂并越过红色隔离阈值。基础 prompt 要求写实工业 CCTV、污染为抽象分节工业残余而非动物或怪物、无血腥/人员/文字/品牌/水印/烘焙扫描线；residue 与 breach 由 contained 参考图定向编辑。

原图 1536×864 PNG；发布图 1280×720 JPEG quality 72，单张 144–184KB。当前只交付静态媒体。短片待办：contained 3 秒凝露/流体轻微运动；没有可信局部运动前不以缩放图冒充录像。
