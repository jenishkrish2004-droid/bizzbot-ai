from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

import requests
from email_validator import EmailNotValidError, validate_email


EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_PATTERN = re.compile(
    r"(?<!\w)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}(?!\w)"
)
URL_PATTERN = re.compile(r"\b(?:https?://|www\.)[^\s<>)\"']+", re.IGNORECASE)
LINKEDIN_PATTERN = re.compile(r"\b(?:https?://)?(?:www\.)?linkedin\.com/[^\s<>)\"']+", re.IGNORECASE)

INTENT_KEYWORDS = {
    "hiring": ["hiring", "recruiting", "talent", "open role", "job opening"],
    "funding": ["funding", "seed", "series a", "series b", "investment", "investor"],
    "partnership": ["partner", "partnership", "reseller", "channel"],
    "sales": ["pricing", "demo", "proposal", "purchase", "buy", "vendor"],
    "growth": ["expansion", "growth", "new market", "scaling"],
    "support": ["support", "implementation", "onboarding", "migration"],
}

DESIGNATION_HINTS = [
    "founder",
    "co-founder",
    "chief executive officer",
    "ceo",
    "chief technology officer",
    "cto",
    "chief marketing officer",
    "cmo",
    "director",
    "manager",
    "president",
    "vice president",
    "vp",
    "head of",
    "partner",
    "consultant",
]


@dataclass
class ExtractedLead:
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    company: str | None = None
    designation: str | None = None
    location: str | None = None
    website: str | None = None
    linkedin: str | None = None
    intent: list[str] = field(default_factory=list)
    confidence_score: float = 0.0
    source_text: str | None = None

    def key(self) -> str:
        if self.email:
            return f"email:{self.email.lower()}"
        if self.linkedin:
            return f"linkedin:{self.linkedin.lower()}"
        if self.phone:
            return f"phone:{normalize_phone(self.phone)}"
        return f"name:{(self.name or '').lower()}:{(self.company or '').lower()}"


def extract_leads(
    *,
    text: str,
    openai_api_key: str | None = None,
    openai_model: str = "gpt-4o-mini",
    gemini_api_key: str | None = None,
    gemini_model: str = "gemini-1.5-flash",
) -> list[ExtractedLead]:
    regex_leads = _extract_with_regex(text)
    llm_leads = _extract_with_llm(
        text=text,
        openai_api_key=openai_api_key,
        openai_model=openai_model,
        gemini_api_key=gemini_api_key,
        gemini_model=gemini_model,
    )
    return deduplicate_leads([*regex_leads, *llm_leads])


def deduplicate_leads(leads: list[ExtractedLead]) -> list[ExtractedLead]:
    merged: dict[str, ExtractedLead] = {}

    for lead in leads:
        normalized = normalize_lead(lead)
        if not (normalized.email or normalized.phone or normalized.linkedin or normalized.name):
            continue

        key = normalized.key()
        existing = merged.get(key)
        if not existing:
            merged[key] = normalized
            continue

        merged[key] = _merge_leads(existing, normalized)

    return sorted(
        (score_lead(lead) for lead in merged.values()),
        key=lambda item: item.confidence_score,
        reverse=True,
    )


def normalize_lead(lead: ExtractedLead) -> ExtractedLead:
    lead.email = normalize_email(lead.email) if lead.email else None
    lead.phone = normalize_phone(lead.phone) if lead.phone else None
    lead.website = normalize_url(lead.website) if lead.website else None
    lead.linkedin = normalize_url(lead.linkedin) if lead.linkedin else None
    lead.intent = sorted({item.strip().lower() for item in lead.intent if item and item.strip()})

    for field_name in ["name", "company", "designation", "location"]:
        value = getattr(lead, field_name)
        if isinstance(value, str):
            setattr(lead, field_name, _clean_label(value))

    if lead.source_text:
        lead.source_text = " ".join(lead.source_text.split())[:1200]

    return lead


def normalize_email(value: str) -> str | None:
    try:
        return validate_email(value, check_deliverability=False).normalized.lower()
    except EmailNotValidError:
        return None


def normalize_phone(value: str) -> str:
    value = re.sub(r"[^\d+]", "", value)
    if value.count("+") > 1:
        value = value.replace("+", "")
    return value


def normalize_url(value: str) -> str:
    cleaned = value.strip().rstrip(".,;)")
    if not cleaned.startswith(("http://", "https://")):
        cleaned = f"https://{cleaned}"
    return cleaned


def score_lead(lead: ExtractedLead) -> ExtractedLead:
    score = 0.15
    score += 0.25 if lead.email else 0
    score += 0.15 if lead.phone else 0
    score += 0.12 if lead.name else 0
    score += 0.12 if lead.company else 0
    score += 0.08 if lead.designation else 0
    score += 0.06 if lead.website else 0
    score += 0.05 if lead.linkedin else 0
    score += min(0.08, len(lead.intent) * 0.02)
    lead.confidence_score = round(min(score, 0.99), 2)
    return lead


def _extract_with_regex(text: str) -> list[ExtractedLead]:
    leads: list[ExtractedLead] = []
    emails = list(dict.fromkeys(EMAIL_PATTERN.findall(text)))
    phones = list(dict.fromkeys(PHONE_PATTERN.findall(text)))
    urls = list(dict.fromkeys(URL_PATTERN.findall(text)))
    linkedins = list(dict.fromkeys(LINKEDIN_PATTERN.findall(text)))

    for email in emails:
        context = _context_window(text, email)
        lead = ExtractedLead(
            email=email,
            phone=_nearest_match(context, phones),
            website=_nearest_match(context, [url for url in urls if "linkedin.com" not in url.lower()]),
            linkedin=_nearest_match(context, linkedins),
            source_text=context,
            intent=_detect_intent(context),
        )
        lead.name = _infer_name_near_email(context, email)
        lead.company = _infer_company(context, lead.website, email)
        lead.designation = _infer_designation(context)
        lead.location = _infer_location(context)
        leads.append(lead)

    consumed = {normalize_phone(lead.phone) for lead in leads if lead.phone}
    for phone in phones:
        if normalize_phone(phone) in consumed:
            continue
        context = _context_window(text, phone)
        lead = ExtractedLead(
            phone=phone,
            website=_nearest_match(context, [url for url in urls if "linkedin.com" not in url.lower()]),
            linkedin=_nearest_match(context, linkedins),
            source_text=context,
            intent=_detect_intent(context),
        )
        lead.name = _infer_name_from_context(context)
        lead.company = _infer_company(context, lead.website, None)
        lead.designation = _infer_designation(context)
        lead.location = _infer_location(context)
        leads.append(lead)

    for linkedin in linkedins:
        if any(lead.linkedin and linkedin.lower() in lead.linkedin.lower() for lead in leads):
            continue
        context = _context_window(text, linkedin)
        leads.append(
            ExtractedLead(
                name=_infer_name_from_context(context),
                company=_infer_company(context, None, None),
                designation=_infer_designation(context),
                location=_infer_location(context),
                linkedin=linkedin,
                source_text=context,
                intent=_detect_intent(context),
            )
        )

    return leads


def _extract_with_llm(
    *,
    text: str,
    openai_api_key: str | None,
    openai_model: str,
    gemini_api_key: str | None,
    gemini_model: str,
) -> list[ExtractedLead]:
    sample = text[:12000]
    if not sample.strip():
        return []

    try:
        if openai_api_key:
            payload = _openai_structured_extract(sample, openai_api_key, openai_model)
        elif gemini_api_key:
            payload = _gemini_structured_extract(sample, gemini_api_key, gemini_model)
        else:
            return []
    except Exception:
        return []

    leads = payload.get("leads", []) if isinstance(payload, dict) else []
    extracted: list[ExtractedLead] = []
    for item in leads:
        if not isinstance(item, dict):
            continue
        extracted.append(
            ExtractedLead(
                name=item.get("name"),
                email=item.get("email"),
                phone=item.get("phone"),
                company=item.get("company"),
                designation=item.get("designation"),
                location=item.get("location"),
                website=item.get("website"),
                linkedin=item.get("linkedin"),
                intent=item.get("intent") if isinstance(item.get("intent"), list) else [],
                source_text=item.get("source_text") or sample[:700],
            )
        )
    return extracted


def _openai_structured_extract(text: str, api_key: str, model: str) -> dict[str, Any]:
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Extract sales leads from business text. Return strict JSON with key 'leads'. "
                        "Each lead may include name,email,phone,company,designation,location,website,"
                        "linkedin,intent array,source_text. Do not invent unavailable fields."
                    ),
                },
                {"role": "user", "content": text},
            ],
            "temperature": 0.1,
        },
        timeout=45,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return json.loads(content)


def _gemini_structured_extract(text: str, api_key: str, model: str) -> dict[str, Any]:
    prompt = (
        "Extract sales leads from the text. Return only JSON with key 'leads'. "
        "Each lead may include name,email,phone,company,designation,location,website,linkedin,intent,source_text. "
        "Do not invent fields.\n\n"
        f"{text}"
    )
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        params={"key": api_key},
        json={"contents": [{"parts": [{"text": prompt}]}]},
        timeout=45,
    )
    response.raise_for_status()
    raw = response.json()["candidates"][0]["content"]["parts"][0]["text"]
    raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(raw)


def _merge_leads(first: ExtractedLead, second: ExtractedLead) -> ExtractedLead:
    for field_name in ["name", "email", "phone", "company", "designation", "location", "website", "linkedin", "source_text"]:
        if not getattr(first, field_name) and getattr(second, field_name):
            setattr(first, field_name, getattr(second, field_name))
    first.intent = sorted({*(first.intent or []), *(second.intent or [])})
    first.confidence_score = max(first.confidence_score, second.confidence_score)
    return first


def _context_window(text: str, needle: str, radius: int = 650) -> str:
    index = text.lower().find(needle.lower())
    if index < 0:
        return text[: radius * 2]
    start = max(0, index - radius)
    end = min(len(text), index + len(needle) + radius)
    return text[start:end]


def _nearest_match(context: str, candidates: list[str]) -> str | None:
    context_lower = context.lower()
    for candidate in candidates:
        if candidate and candidate.lower() in context_lower:
            return candidate
    return None


def _detect_intent(text: str) -> list[str]:
    lowered = text.lower()
    intents = []
    for intent, keywords in INTENT_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            intents.append(intent)
    return intents


def _infer_name_near_email(context: str, email: str) -> str | None:
    before = context.split(email, 1)[0]
    return _infer_name_from_context(before)


def _infer_name_from_context(context: str) -> str | None:
    lines = [line.strip(" -:\t") for line in context.splitlines() if line.strip()]
    for line in reversed(lines[-8:]):
        if EMAIL_PATTERN.search(line) or URL_PATTERN.search(line) or len(line) > 80:
            continue
        match = re.search(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b", line)
        if match and not _looks_like_company(match.group(1)):
            return match.group(1)
    return None


def _infer_company(context: str, website: str | None, email: str | None) -> str | None:
    for line in context.splitlines():
        company_match = re.search(r"(?:Company|Organization|Employer)\s*[:\-]\s*([A-Za-z0-9&.,' -]{2,80})", line, re.I)
        if company_match:
            return company_match.group(1)

    domain_source = website or (email.split("@", 1)[1] if email and "@" in email else None)
    if domain_source:
        parsed = urlparse(normalize_url(domain_source))
        domain = parsed.netloc or parsed.path
        domain = domain.replace("www.", "").split(".")[0]
        if domain and domain not in {"gmail", "yahoo", "outlook", "hotmail", "icloud"}:
            return domain.replace("-", " ").title()
    return None


def _infer_designation(context: str) -> str | None:
    lowered = context.lower()
    for hint in DESIGNATION_HINTS:
        if hint in lowered:
            match = re.search(rf"\b([A-Za-z ]{{0,35}}{re.escape(hint)}[A-Za-z ]{{0,35}})\b", context, re.I)
            if match:
                return _clean_label(match.group(1))
            return hint.upper() if hint in {"ceo", "cto", "cmo", "vp"} else hint.title()
    return None


def _infer_location(context: str) -> str | None:
    match = re.search(r"(?:Location|Based in|Address)\s*[:\-]?\s*([A-Za-z0-9,.' -]{3,90})", context, re.I)
    if match:
        return _clean_label(match.group(1))
    return None


def _looks_like_company(value: str) -> bool:
    return bool(re.search(r"\b(Inc|LLC|Ltd|Technologies|Systems|Solutions|Group|Company)\b", value))


def _clean_label(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip(" -:\t,.;")).strip()[:180]
