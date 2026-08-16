# Architecture

## 坐标系约定（一切战术推理的地基）

球场坐标系（米，俯视）：

```
x ∈ [0, 10.97]   0 = 左边线（双打）, 10.97 = 右边线
y ∈ [0, 23.77]   0 = 近端(镜头侧)底线, 23.77 = 远端底线
net              y = 11.885
```

Player 1 固定近端半场，Player 2 远端半场。所有事件、区域、方向都在这个
坐标系里推理，与镜头分辨率无关。

## Pipeline（阶段状态机）

```
queued → ingest → detect → map → events → tactics → report → done
                     (demo 模式跳过 detect/map)
```

- **ingest**: 读视频元数据（fps 不假设）；demo 模式生成合成比赛
  （`fixtures.py`，含两个植入模式：P1 平分区 wide 发球+斜线第三拍 ≈80% 得分；
  P2 拥有 9+ 拍长回合）。
- **detect**: YOLO 球员（COCO person，懒加载 ultralytics）+ 自定义网球权重；
  球 bbox 经尺寸/长宽比合理性过滤；流式读帧。
- **map**: 球场关键点模型（可选）→ `cv2.findHomography` 像素→球场坐标；
  无模型时用球员/球分布的鲁棒百分位框拟合代理映射，并在结果里降级标注。
- **events**: 见下。
- **tactics**: 模式挖掘（`patterns.py`），输出 PatternCard。
- **report**: LangChain 链（有 key）或确定性中文模板（无 key），保存 JSON。

## 事件引擎（与教程式实现的三点本质区别）

1. **击球 = 球场坐标系 y 方向的持续反转**。俯视图里一次往返中，反弹不会
   反转球的前进方向，只有球员击球会——从源头消解 bounce/击球混淆。
   再用"反转帧球与最近球员 ≤ 2.4m"确认归属。
2. **发球 = 追踪空档后球的重新出现**（持续位移 + 邻近发球方），
   解决"序列首段无方向可反转"的漏检。
3. **落地 = 速度的快→慢台阶**（前后窗口均值对比，均值吸收逐帧噪声；
   窗口位置取台阶之后，避免"检测点落在骤降前几帧"的系统性偏差）。
   落地给出：发球方向标注（T/body/wide，相对目标发球区三分）、击球方向
   （cross/line/middle，横向三分 + 是否穿越中线）、以及正确的截击判据
   （击球前无落地 + 网前区域接触）。

回合切分：击球间隔 > ~3s 或球员连续两次击球（后一次覆盖前一次）即断开；
胜负推断：最后击球者的球在对方半场双跳 → 高置信；单跳 → 中置信；
追踪截断 → 低置信（界面展示置信度）。

## 已知局限（诚实边界）

- 无姿态 → 不标注正手/反手（拒绝伪分类）；
- 平面速度近似；胜负为启发式；机位/权重质量决定追踪上限；
- 单进程 BackgroundTasks，长视频应升级 Celery/Redis（JobStore 接口已隔离）。

## LLM 层

- `llm/report.py`: ChatPromptTemplate(system=教练人设 + 引用证据约束) | ChatOpenAI；
  输入是压缩后的结构化摘要（`analysis_digest`），不是原始帧数据。
- `llm/chat.py`: 摘要 + 最近 6 轮历史的问答；系统提示强制"只依据 JSON 事实"。
- 无 key：`_heuristic_report` / `_heuristic_answer` 提供确定性输出，
  `report_generated_by` 字段如实标注生成来源。

## 前端

- `lib/api.ts`：与后端 pydantic 模型一一对应的 TS 类型。
- `/analyses/[id]`：轮询 job 状态（running 时 1.2s），done 后切换四个视图。
- `MiniCourt`：纯 SVG 球场（10.97×23.75 viewBox），击球点→落点箭头按球员着色，
  发球/截击打标记；`RallyBrowser` 提供逐分点击回放 + 逐拍语义条目。

## 测试策略

- 纯函数优先：几何/事件/模式全部可在无模型环境测试；
- 合成轨迹单测（`test_events.py`）：手工构造两拍往返，断言反转/速度台阶/确认归属；
- 演示比赛端到端（`test_patterns.py`）：植入模式必须被完整找回
  （`serve_1_deuce_wide`、`sp1_1_deuce_wide_cross`、`rallylen_long9+_2`）；
- API 测试（`test_api.py`）：TestClient 同步跑 BackgroundTasks，覆盖
  健康检查、demo 全流程、降级路径（full 无权重要 400，未知 id 404）。
