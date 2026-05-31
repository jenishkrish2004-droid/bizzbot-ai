from __future__ import annotations

import requests


def synthesize_answer(
    *,
    question: str,
    contexts: list[dict],
    api_key: str | None = None,
    model: str = "gpt-4o-mini",
) -> str:
    if api_key:
        return _openai_answer(question=question, contexts=contexts, api_key=api_key, model=model)

    return _extractive_answer(question=question, contexts=contexts)


def _openai_answer(*, question: str, contexts: list[dict], api_key: str, model: str) -> str:
    context_text = "\n\n".join(
        f"[Source {index + 1}]\n{item['content']}" for index, item in enumerate(contexts)
    )
    prompt = (
        "You are BizzBot AI, a precise RAG assistant for business documents. "
        "Answer only from the provided context. If the answer is not supported, say so. "
        "Mention source numbers where useful.\n\n"
        f"Question: {question}\n\nContext:\n{context_text}"
    )

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": "You answer with concise, citation-aware business analysis."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
        },
        timeout=45,
    )
    response.raise_for_status()
    payload = response.json()
    return payload["choices"][0]["message"]["content"].strip()


def _extractive_answer(*, question: str, contexts: list[dict]) -> str:
    if not contexts:
        return "I could not find relevant indexed content for that question."

    snippets = [_clean_snippet(item["content"]) for item in contexts[:3]]
    answer_lines = [
        "I found the most relevant passages in the indexed document. Based on those sections:",
        "",
    ]
    answer_lines.extend(f"- {snippet}" for snippet in snippets if snippet)
    answer_lines.append("")
    answer_lines.append("For a generative answer, add an OpenAI API key; this fallback stays extractive and citation-safe.")
    return "\n".join(answer_lines)


def _clean_snippet(text: str) -> str:
    compact = " ".join(text.split())
    if len(compact) <= 360:
        return compact
    return compact[:357].rsplit(" ", 1)[0] + "..."
