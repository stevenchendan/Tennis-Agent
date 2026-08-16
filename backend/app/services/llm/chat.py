"""Coach chat grounded in one analysis result.

With an LLM: a chat prompt carrying the analysis digest + recent history.
Without: a deterministic Q&A over the pattern cards and stats (keyword
routing), so the chat never errors out.
"""

from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

from app.core.config import Settings
from app.domain.events import AnalysisResult
from app.services.llm.chains import get_chat_model
from app.services.llm.report import analysis_digest

SYSTEM = """你是"战术教练"，只回答与这场已分析比赛相关的问题。
你唯一的知识来源是下面的比赛分析 JSON（以及对话历史）。
规则：
- 回答必须基于 JSON 中的事实；JSON 里没有的信息就说"这场数据里没有"，不要猜。
- 涉及"我该怎么办"时，优先结合 JSON 中的 pattern 卡证据给可执行建议。
- 用中文，简洁，像场边复盘。可以引用具体分号。
"""

USER = """比赛分析 JSON：

{digest}

问题：{question}"""


def answer_question(
    result: AnalysisResult,
    history: list[dict],
    question: str,
    settings: Settings,
) -> str:
    model = get_chat_model(settings)
    if model is not None:
        prompt = ChatPromptTemplate.from_messages(
            [("system", SYSTEM)]
            + [(m["role"], m["content"]) for m in history[-6:]]
            + [("user", USER)]
        )
        chain = prompt | model
        resp = chain.invoke({"digest": analysis_digest(result), "question": question})
        return str(resp.content)
    return _heuristic_answer(result, question)


def _heuristic_answer(result: AnalysisResult, question: str) -> str:
    q = question.lower()
    cards = result.patterns
    if not cards:
        return "这场分析里还没有足够的模式数据。"
    if any(k in q for k in ["发球", "serve", "一发"]):
        serves = [c for c in cards if "serve" in c.code and "sp1" not in c.code]
        if serves:
            c = serves[0]
            return f"{c.description} 证据：第 {', '.join(map(str, c.evidence_rally_ids[:6]))} 分。{c.takeaway}（配置 LLM key 后可追问更细的球路。）"
    if any(k in q for k in ["长", "多拍", "rally", "回合"]):
        s = result.stats
        return (
            f"全场平均 {s.avg_rally_length} 拍，最长 {s.longest_rally} 拍。"
            "（配置 LLM key 后可以针对某一分展开。）"
        )
    if any(k in q for k in ["网前", "volley", "截击"]):
        nets = [c for c in cards if c.code.startswith("net_")]
        if nets:
            return f"{nets[0].description} {nets[0].takeaway}"
    c = cards[0]
    return f"最突出的模式：{c.title} —— {c.description} {c.takeaway}（配置 LLM key 后可以自由提问。）"
