"""Tactical report generation.

With an LLM key: a LangChain chain turns the structured analysis digest
into a coaching report (Chinese, three sections, evidence-grounded).
Without: a deterministic template report is rendered from the same digest
so the product never blocks on the key.
"""

from __future__ import annotations

import json

from langchain_core.prompts import ChatPromptTemplate

from app.core.config import Settings
from app.domain.events import AnalysisResult
from app.services.llm.chains import get_chat_model

SYSTEM = """你是一位职业网球战术教练，擅长把比赛数据讲成普通球员能听懂、能模仿、能练的东西。
你会拿到一份结构化的比赛分析 JSON（回合、击球、模式卡）。写报告时遵守：
- 只依据 JSON 中的事实与数字，禁止编造未出现的数字或球员。
- 每个观点都要引用证据（例如"第 3、7、12 分"或"24 分中赢下 17 分"）。
- 每个模式给出：它长什么样(球路)、为什么有效、业余球员如何在自己的比赛中使用/针对它。
- 语气：像教练在场边跟学员复盘，不要营销腔。
用 Markdown 输出，结构为：
## 比赛速览
## 关键战术模式 (逐个讲，每个含"怎么用在你自己的比赛里")
## 本场最值得练的 3 件事 (具体到练法)
"""

USER = """比赛分析数据如下：

{digest}

请生成战术报告。"""

HEURISTIC_TEMPLATE = """## 比赛速览

- 分析来源：{source}（{mode} 模式，{points} 分，共 {shots_total} 拍）
- 平均回合长度：{avg_rally} 拍；最长 {longest_rally} 拍
- 得分：Player 1 {w1} 分 / Player 2 {w2} 分
- 球路分布：P1 斜线 {p1_cross}、直线 {p1_line}、中路 {p1_middle}；P2 斜线 {p2_cross}、直线 {p2_line}、中路 {p2_middle}

## 关键战术模式

{pattern_sections}

## 本场最值得练的 3 件事

{drills}

---
*本报告由规则引擎生成（未配置 LLM key）。设置 TENNIS_OPENAI_API_KEY 后可获得教练视角的深度解读。*
"""


def analysis_digest(result: AnalysisResult) -> str:
    """Compact, LLM-friendly JSON summary of the analysis."""
    stats = result.stats
    rallies = []
    for r in result.rallies[:40]:
        rallies.append(
            {
                "id": r.id,
                "server": r.server,
                "side": r.serve_side.value,
                "winner": r.winner,
                "end_reason": r.end_reason,
                "shots": [
                    {
                        "p": s.player_id,
                        "serve": s.is_serve,
                        "volley": s.is_volley,
                        "dir": s.direction.value if s.direction else None,
                        "zone": s.zone.value if s.zone else None,
                        "from": [round(s.hit_position[0], 1), round(s.hit_position[1], 1)],
                        "to": [round(s.landing_position[0], 1), round(s.landing_position[1], 1)]
                        if s.landing_position
                        else None,
                    }
                    for s in r.shots
                ],
            }
        )
    return json.dumps(
        {
            "stats": stats.model_dump(),
            "patterns": [p.model_dump(exclude={"evidence_rally_ids"}) for p in result.patterns],
            "rallies": rallies,
        },
        ensure_ascii=False,
    )


def generate_report(result: AnalysisResult, settings: Settings) -> tuple[str, str]:
    """Returns (markdown_report, generator_name)."""
    model = get_chat_model(settings)
    if model is not None:
        prompt = ChatPromptTemplate.from_messages([("system", SYSTEM), ("user", USER)])
        chain = prompt | model
        resp = chain.invoke({"digest": analysis_digest(result)})
        return str(resp.content), "llm"
    return _heuristic_report(result), "heuristic"


def _heuristic_report(result: AnalysisResult) -> str:
    s = result.stats
    d = s.direction_counts
    sections = []
    for p in result.patterns[:6]:
        evidence = f"证据：第 {', '.join(map(str, p.evidence_rally_ids[:8]))} 分"
        sections.append(
            f"### {p.title}\n\n{p.description}。{evidence}。\n\n**怎么用在你自己的比赛里**：{p.takeaway}\n"
        )
    drills = "\n".join(
        f"{i}. {p.takeaway}" for i, p in enumerate(result.patterns[:3], 1)
    ) or "1. 数据不足：先积累更多完整回合。"
    return HEURISTIC_TEMPLATE.format(
        source=result.source,
        mode=result.mode,
        points=s.points,
        shots_total=sum(s.shots.values()),
        avg_rally=s.avg_rally_length,
        longest_rally=s.longest_rally,
        w1=s.points_won.get(1, 0),
        w2=s.points_won.get(2, 0),
        p1_cross=d.get(1, {}).get("cross", 0),
        p1_line=d.get(1, {}).get("line", 0),
        p1_middle=d.get(1, {}).get("middle", 0),
        p2_cross=d.get(2, {}).get("cross", 0),
        p2_line=d.get(2, {}).get("line", 0),
        p2_middle=d.get(2, {}).get("middle", 0),
        pattern_sections="\n".join(sections),
        drills=drills,
    )
