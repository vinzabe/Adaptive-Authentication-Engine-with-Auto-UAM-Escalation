"""LLM-driven security audit of a zk-auth deployment."""
from __future__ import annotations
import json
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class ZKAudit:
    posture: str                       # strong | moderate | weak
    confidence: float
    findings: List[Dict[str, str]] = field(default_factory=list)
    replay_protection: str = "unknown"
    side_channels: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    raw: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "posture": self.posture, "confidence": self.confidence,
            "findings": self.findings,
            "replay_protection": self.replay_protection,
            "side_channels": self.side_channels,
            "recommendations": self.recommendations,
        }


class LLMZKAuditor:
    SYSTEM = (
        "You are a zero-knowledge proof / authentication auditor. "
        "Given a description of a Groth16-based authentication deployment, "
        "return strict JSON with keys: posture (strong|moderate|weak), "
        "confidence (0..1), findings (array of {name, severity, "
        "description, mitigation}), replay_protection (strong|partial|none), "
        "side_channels (array), recommendations (array). "
        "Cover: trusted-setup ceremony rigor, MPC participants, choice of "
        "circuit (Poseidon vs other), public-signal binding, challenge "
        "freshness/TTL, key rotation, and on-chain vs off-chain verification."
    )

    def __init__(self, llm_client, *, model: str = "glm-5.1",
                  temperature: float = 0.15, max_tokens: int = 1400):
        self.llm = llm_client
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

    # ------------------------------------------------------------------
    def audit(self, deployment: Dict[str, Any]) -> ZKAudit:
        msgs = [
            {"role": "system", "content": self.SYSTEM},
            {"role": "user", "content": (
                "Audit this zk-auth deployment. Reply with JSON only.\n"
                + json.dumps(deployment, indent=2))},
        ]
        resp = self.llm.chat(msgs, model=self.model,
                              temperature=self.temperature,
                              max_tokens=self.max_tokens)
        return self._parse(resp.content)

    # ------------------------------------------------------------------
    @staticmethod
    def _extract_json(text: str) -> str:
        t = (text or "").strip()
        m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", t, re.DOTALL)
        if m:
            return m.group(1)
        m = re.search(r"\{.*\}", t, re.DOTALL)
        return m.group(0) if m else t

    def _parse(self, content: str) -> ZKAudit:
        try:
            data = json.loads(self._extract_json(content))
        except json.JSONDecodeError:
            return ZKAudit(posture="weak", confidence=0.0,
                            recommendations=["LLM output unparseable; re-run"],
                            raw=content[:2000])
        posture = str(data.get("posture", "moderate")).lower()
        if posture not in ("strong", "moderate", "weak"):
            posture = "moderate"
        try:
            conf = float(data.get("confidence", 0.5))
        except (TypeError, ValueError):
            conf = 0.5
        rp = str(data.get("replay_protection", "unknown")).lower()
        if rp not in ("strong", "partial", "none", "unknown"):
            rp = "unknown"
        findings = []
        for f in (data.get("findings") or []):
            if isinstance(f, dict):
                findings.append({
                    "name": str(f.get("name", "")).strip(),
                    "severity": str(f.get("severity", "")).strip().lower() or "medium",
                    "description": str(f.get("description", "")).strip(),
                    "mitigation": str(f.get("mitigation", "")).strip(),
                })
        def _arr(v):
            if v is None:
                return []
            if isinstance(v, str):
                return [v]
            return [str(x) for x in v]
        return ZKAudit(
            posture=posture, confidence=conf,
            findings=findings,
            replay_protection=rp,
            side_channels=_arr(data.get("side_channels")),
            recommendations=_arr(data.get("recommendations")),
            raw=content[:2000],
        )
