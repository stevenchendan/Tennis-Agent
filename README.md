# Tennis-Agent 🎾

**看懂网球比赛，而不只是看个热闹。**

上传一场比赛视频 → 追踪每一次击球 → 切分每一分 → 挖掘可复用的战术模式
（发球+1 球路、方向组合、回合长度↔胜负关系、网前胜率）→ 教练报告 + 问答，
把职业战术变成你自己能练的东西。

技术栈：**Next.js 15**（前端）+ **FastAPI**（后端）+ **YOLO/ultralytics**（检测）
+ **LangChain**（战术解读层）。

> 本项目的立项 review（我们为什么不直接用 Tennis-Vision 那类项目）见
> [`docs/REVIEW.md`](docs/REVIEW.md)。

## 快速开始

前置：Python 3.10+，Node 18+。

```bash
# 后端（首次）
cd backend
py -3.10 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt -r requirements-dev.txt

# 启动 API（http://localhost:8000）
.venv/Scripts/python -m uvicorn app.main:app --reload

# 前端（另开终端，http://localhost:3000）
cd frontend
npm install
npm run dev
```

打开 http://localhost:3000 → 点 **"看一场演示比赛"**。
演示模式使用一场内置的合成比赛（带两个"植入"的战术模式），
**不需要任何模型权重、GPU 或 API key**，完整走通
检测→事件→模式→报告→问答 的全部界面。

### 跑测试

```bash
cd backend
.venv/Scripts/python -m pytest tests/ -q --basetemp=./.pytest_tmp
```

24 个测试覆盖：球场几何（deuce/ad、深度区、发球方向标注）、事件引擎
（击球/落地判别、回合切分、发球检测、截击判定）、模式挖掘
（植入模式必须被端到端找回）、API（上传/分析/问答全流程）。

## 分析真实视频（full 模式）

需要一个网球检测 YOLO 权重（任意 ultralytics 格式）：

1. 取得 tennis-ball 权重（例如 Roboflow 公开 tennis-ball 数据集训练的
   yolov8 模型，或 Tennis-Vision 仓库 README 提供的 `last.pt`）；
2. （可选）球场关键点权重（ResNet50、14 关键点，即社区通用的
   `keypoints_model.pth`），用于精确单应映射；
3. 配置环境变量（或 `backend/.env`）：

```ini
TENNIS_BALL_MODEL_PATH=models/last.pt      # 必需
TENNIS_COURT_MODEL_PATH=models/keypoints_model.pth  # 可选，缺省用代理映射（会降级标注）
TENNIS_PLAYER_MODEL_PATH=yolov8n.pt        # 球员检测，缺省 yolov8n
```

然后在首页上传视频即可。**拍摄建议**：固定机位、能看到全场两个底线、
俯视角度越大越好（转播式机位最理想）。

## LLM 战术报告与问答（可选）

```ini
TENNIS_OPENAI_API_KEY=sk-...
# 如使用代理/网关：
# TENNIS_OPENAI_BASE_URL=https://your-gateway/v1
TENNIS_LLM_MODEL=gpt-4o-mini
```

没配 key？一切都照常工作：报告由确定性模板生成（规则引擎），
问答走基于模式卡片的启发式路由，界面上会明确标注。

## 架构一览

```
frontend/  Next.js 15 (App Router, TS, Tailwind v4)
  ├─ /                上传 / 演示入口
  └─ /analyses/[id]   仪表盘：阶段进度 · 战术报告 · 模式卡片 · 逐分回放(SVG球场) · 教练问答

backend/   FastAPI (Python 3.10, pydantic v2)
  ├─ app/api          videos / analyses / chat 路由
  ├─ app/services
  │   ├─ detection    YOLO(懒加载) + 球场关键点 + 流式读帧
  │   ├─ analysis     事件引擎 · 球场几何 · 模式挖掘
  │   ├─ llm          LangChain 报告链 + 教练问答（启发式降级）
  │   ├─ fixtures     合成演示比赛（无权重可完整体验）
  │   └─ pipeline     阶段编排 + 任务状态机
  └─ tests/           24 tests
```

数据流：`视频 → YOLO(球员/球) → 球场坐标单应映射 → 事件引擎
(击球/落地/回合/发球/截击) → 模式挖掘(PatternCard×N) → LangChain 报告/问答`。

设计细节见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 我们输出的"模式"

| 类别 | 例子 |
| --- | --- |
| 发球方向 | "P1 平分区 wide 发球：占该侧 100%，身后得分率 80%" |
| 发球+1 | "wide 发球 → 第三拍斜线：N 分，赢 M 分" —— 现代网球最核心的"设计分" |
| 球路 n-gram | "P2 最爱连续两拍 middle→middle，可预判" |
| 回合长度 | "P1 拥有 ≤4 拍短回合（70%），P2 拥有 9+ 拍长回合" |
| 位置 | "P1 上网 N 分，转化率 X%" |

每张卡片带：样本量、置信度、**证据分号**、以及"怎么用在你自己的比赛里"。

## 明确的边界（诚实声明）

- 击球类型（正手/反手/切削）需要姿态估计，当前不做——我们拒绝输出无法验证的伪分类；
- 球速是**平面投影近似值**（忽略弧线），仅作趋势参考；
- 胜负归属是启发式推断（双跳/无回球信号 + 置信度），界面如实展示置信度；
- 逐帧追踪质量取决于球检测权重与机位，追踪不足时分析会明确失败而不是硬编结果。

## Roadmap

- [ ] pose estimation（MediaPipe/YOLO-pose）→ 真正的正反手/开放式站位识别
- [ ] 球员重识别 + 双打支持
- [ ] Celery/Redis 任务队列（长视频异步分析）
- [ ] 模式库跨场次聚合（"你的发球+1 vs 全网样本"）
- [ ] 视频时间轴联动（点击某一分跳到源视频时刻）
