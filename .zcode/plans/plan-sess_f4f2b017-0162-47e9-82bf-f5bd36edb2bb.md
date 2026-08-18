# 职业级功能四件套(全部纯前端,零后端改动)

## 1. 逐分回放 → 战术板一键转化
**新文件 `src/lib/rally-to-tactic.ts`**:把 `Rally` 转成 `Tactic`——每拍一帧:击球者站在 `hit_position`,对手站在其下一拍 `hit_position`(最后一拍回中底线),球路 = `hit→landing`。发球/截击/方向写入极简帧备注(控制 URL 长度)。>30 拍截断,`landing_position` 为空的拍跳过球路只保留站位。标题自动生成"第 N 分 · P? 发球"。
**改动 `RallyBrowser.tsx`**:回合详情卡加"转为战术板动画 →"按钮,跳 `/board?import=<encodeTactic(t)>`。
**改动 `BoardEditor.tsx`**:挂载时优先读 `?import=` 参数载入战术(其次 localStorage 草稿)。

## 2. 战术模板库(O'Shannessy 式)
**新文件 `src/lib/templates.ts`**:6 个预制模板,每个是返回 `Tactic` 的函数:平分区外角发球+正手空档、占先区T点发球+随上、发球+1斜线压制、接发抢攻直线、双打发球抢网(poach)、放短+上旋挑高。含中文标题与帧备注。
**新组件 `src/components/board/TemplatePicker.tsx`**:编辑器头部"模板"按钮的下拉面板,选择即载入(带确认,防止覆盖当前草稿)。

## 3. Game Plan 作战计划页
**新文件 `src/lib/gameplan.ts`**:按 pattern category 确定性生成应对策略文案(serve/serve_plus_one/rally/direction/position 五类,结合 pattern 描述取变体),不依赖 LLM。
**新组件 `src/components/GamePlan.tsx`**:① 比赛快照(复用 stats);② 每张 top 模式卡:模式 + 应对策略 + 证据回合 chips(点击跳逐分回放查看)+ "在战术板中演练 →"按钮(关联模板预填);③ "打印/存 PDF"按钮。
**改动 `analyses/[id]/page.tsx`**:加第 5 个 tab"作战计划";把当前回合选中状态提升到 page 层,让 Game Plan 能跳转到指定回合。
**改动 `globals.css`**:加 `@media print` 基础样式(隐藏导航/tab,白底)。

## 4. 关键分情境筛选(比分推断)
**新文件 `src/lib/score.ts`**:`inferMatchState(rallies)` 前端模拟网球计分——发球方变化即局边界,局内按逐分 `winner` 计分,推断比分/局数/破发点(接发方差1分赢局)/局点(发球方差1分赢局)。UI 明确标注"比分为逐分胜负启发式推断",低置信逐分(winner_confidence<0.5)时显示警示。
**改动 `RallyBrowser.tsx`**:三组筛选下拉(情境:全部/破发点/局点/P1、P2发球局 × 结果:P1胜/P2胜 × 长度:≤4/5-8/9+拍),回合按钮 title 显示推断比分;props 加 `activeId`/`onSelect` 受控模式。

## 顺序与验证
实现顺序:2(模板)→ 1(转化)→ 4(筛选)→ 3(Game Plan)。README(英文)补一节 Pro Workflow。验证:`lint`+`build`,起 dev server 用 demo 数据(无需后端起也行,demo 需要后端——用 `node` 直接对 `rally-to-tactic.ts`/`score.ts` 逻辑做单测式脚本验证 + curl SSR 检查 `?import=` 链接;后端在 8000 若可用则跑 demo 全链路)。UI 文案保持中文(README/注释英文)。