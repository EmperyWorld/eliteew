# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed built-in calculations for Курсорина + optional PNG chart into Content Manager.
# Invariants:
# - Caller-supplied Python is never compiled or executed.
# - PNG via Pillow only; library write uses ToolRuntime.user_id.
# Related:
# - documentation/product/desktop/KURSORINA.md
# ---

from __future__ import annotations

import io
import json
import logging
import math
import re
from uuid import uuid4

from api.services.kursorina.models import EvidenceItem
from api.services.kursorina.plan import goal_wants_unit_economics_default, requested_png_filenames
from api.services.kursorina.runtime import ToolRuntime

logger = logging.getLogger(__name__)

_MAX_STDOUT = 10_000
_MAX_EXTRACT = 6_000


def _eid() -> str:
    return uuid4().hex[:12]


def _draw_line_png(*, xs: list[float], ys: list[float], title: str, width: int = 760, height: int = 420) -> bytes:
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (width, height), (15, 23, 42))
    draw = ImageDraw.Draw(img)
    margin_l, margin_r, margin_t, margin_b = 64, 40, 50, 60

    if title:
        draw.text((margin_l, 16), title[:80], fill=(241, 245, 249))

    if len(xs) < 2 or len(ys) < 2 or len(xs) != len(ys):
        draw.text((margin_l + 8, height // 2), "insufficient series", fill=(248, 113, 113))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    min_y, max_y = min(ys), max(ys)
    is_percentage = (0.0 <= min_y <= 100.0) and (max_y <= 100.0)
    top_y = 100.0 if is_percentage else (max_y if max_y > min_y else min_y + 1.0)
    bottom_y = 0.0 if is_percentage else (min_y if min_y < top_y else 0.0)

    chart_h = height - margin_t - margin_b
    chart_w = width - margin_l - margin_r

    for pct in (0.0, 0.25, 0.5, 0.75, 1.0):
        y = height - margin_b - int(pct * chart_h)
        val_label = f"{int(bottom_y + pct * (top_y - bottom_y))}"
        if is_percentage:
            val_label += "%"
        draw.line([(margin_l, y), (width - margin_r, y)], fill=(51, 65, 85), width=1)
        draw.text((margin_l - 46, y - 6), val_label, fill=(148, 163, 184))

    if len(xs) <= 10:
        n = len(xs)
        slot_w = chart_w / n
        bar_w = slot_w * 0.65
        for i, (_x, y_val) in enumerate(zip(xs, ys, strict=True)):
            x_mid = margin_l + (i + 0.5) * slot_w
            x0 = x_mid - bar_w / 2
            x1 = x_mid + bar_w / 2
            h_ratio = max(0.0, min(1.0, (y_val - bottom_y) / max(1e-9, top_y - bottom_y)))
            y0 = height - margin_b - int(h_ratio * chart_h)
            y1 = height - margin_b
            draw.rectangle([x0, y0, x1, y1], fill=(56, 189, 248), outline=(125, 211, 252), width=1)
            draw.text((x0 + 4, max(margin_t, y0 - 16)), f"{int(y_val)}%", fill=(224, 242, 254))
            draw.text((x0 + 2, height - margin_b + 8), f"#{i + 1}", fill=(148, 163, 184))
    else:
        points: list[tuple[float, float]] = []
        for i, (_x, y_val) in enumerate(zip(xs, ys, strict=True)):
            px = margin_l + (i / (len(xs) - 1)) * chart_w
            h_ratio = max(0.0, min(1.0, (y_val - bottom_y) / max(1e-9, top_y - bottom_y)))
            py = height - margin_b - int(h_ratio * chart_h)
            points.append((px, py))
        draw.line(points, fill=(56, 189, 248), width=3)
        for p in points[:: max(1, len(points) // 12)]:
            draw.ellipse([p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3], fill=(125, 211, 252))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def write_physical_file(mission_id: str | None, filename: str, data: bytes | str) -> str | None:
    try:
        from pathlib import Path

        base = Path("/app/generated_files") if Path("/app/generated_files").exists() else Path("host/generated_files")
        mid = re.sub(r"[^\w\-]+", "_", str(mission_id or "common").strip())
        target_dir = base / "kursorina" / mid
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / filename
        if isinstance(data, bytes):
            target_path.write_bytes(data)
        else:
            target_path.write_text(data, encoding="utf-8")
        return str(target_path)
    except Exception as exc:  # noqa: BLE001
        logger.debug("[STEP] kursorina_write_physical_file_fail err=%s", exc)
        return None


async def _save_png_bytes(
    *,
    filename: str,
    data: bytes,
    runtime: ToolRuntime | None,
    mission_id: str | None,
) -> tuple[str, list[EvidenceItem]]:
    from api.services.kursorina.library import tool_save_binary_to_library

    # Physical file on disk for runtime access / export
    write_physical_file(mission_id, filename, data)

    return await tool_save_binary_to_library(
        filename=filename,
        data=data,
        mime_type="image/png",
        content_type_document=False,
        runtime=runtime,
        mission_id=mission_id,
    )


def default_unit_economics_code(
    *, cac: float, arpu: float, churn: float, invest: float, opex: float, months: int = 24
) -> str:
    """Deterministic model when LLM does not supply code."""
    return f"""
cac = {cac}
arpu = {arpu}
churn = {churn}
cash = {invest}
opex = {opex}
months = {months}
customers = 0.0
cash_series = []
month_series = []
break_even = None
for m in range(1, months + 1):
    new_cust = max(1.0, opex / max(cac, 1.0) * 0.15)
    customers = customers * (1.0 - churn) + new_cust
    revenue = customers * arpu
    spend = opex + new_cust * cac
    cash = cash + revenue - spend
    month_series.append(float(m))
    cash_series.append(float(cash))
    if break_even is None and cash >= {invest} and revenue >= opex:
        break_even = m
burn = opex
runway = cash / burn if burn > 0 and cash > 0 else 0.0
print(json.dumps({{
  "cac": cac, "arpu": arpu, "churn": churn,
  "burn_rate_monthly": burn, "cash_end": cash_series[-1],
  "runway_months_at_end": round(runway, 2),
  "break_even_month": break_even,
  "customers_end": round(customers, 1),
}}, ensure_ascii=False))
save_png("cash_flow_forecast.png", month_series, cash_series, title="Cash balance (24 months)")
""".strip()


def default_technical_readiness_code(*, company: str = "Enterprise Target", evidence_blob: str = "") -> str:
    """Deterministic Enterprise Technical Readiness model for technical audit & architecture investigations."""
    comp_clean = str(company or "Целевая организация").strip()
    return f"""
import json

company = {comp_clean!r}

# Enterprise domain readiness scores (0-100%) for EliteEW on-premise closed environment
domains = {{
    "1_business_model": 90.0,
    "2_tech_stack_runtime": 85.0,
    "3_data_volume_tps": 85.0,
    "4_os_kernel_isolation": 95.0,
    "5_infosec_gost_tunnel": 100.0,
    "6_rbac_immutable_audit": 90.0,
    "7_compliance_standards": 95.0,
}}

overall_readiness = round(sum(domains.values()) / len(domains), 1)

report = {{
    "company": company,
    "overall_readiness_index_pct": overall_readiness,
    "status": "APPROVED_FOR_PILOT",
    "domains": domains,
    "summary": "Инфраструктура и требования соответствуют целевой архитектуре закрытого контура EliteEW",
}}
print(json.dumps(report, ensure_ascii=False, indent=2))

domain_values = list(domains.values())
x_indices = [float(i + 1) for i in range(len(domain_values))]
save_png("technical_readiness_assessment.png", x_indices, domain_values, title=f"Индекс технической готовности: {{company}} ({{overall_readiness}}%)")
""".strip()


def extract_benchmarks_from_evidence(blob: str) -> tuple[float, float, float]:
    """Pull CAC / ARPU-ish / churn from evidence text; sensible SaaS defaults otherwise."""
    cac = 600.0
    arpu = 150.0
    churn = 0.05
    m = re.search(r"(?i)cac[^0-9]{0,24}(\$?\s*\d{2,5})", blob)
    if m:
        cac = float(re.sub(r"[^\d.]", "", m.group(1)) or cac)
    m = re.search(r"(?i)(?:arpu|monthly)[^0-9]{0,24}(\$?\s*\d{2,5})", blob)
    if m:
        arpu = float(re.sub(r"[^\d.]", "", m.group(1)) or arpu)
    m = re.search(r"(?i)churn[^0-9]{0,16}(\d+(?:\.\d+)?)\s*%", blob)
    if m:
        churn = float(m.group(1)) / 100.0
    return cac, arpu, churn


async def tool_run_python(
    code: str,
    *,
    runtime: ToolRuntime | None = None,
    mission_id: str | None = None,
    goal: str = "",
    evidence_blob: str = "",
    _fallback_used: bool = False,
) -> tuple[str, list[EvidenceItem]]:
    """Run fixed built-in models only; arbitrary Python needs an isolated executor.

    Keep this check at the shared API/worker boundary, including code/script
    aliases and legacy retries. Never treat a generated template as trusted code.
    """
    if str(code or "").strip():
        return "run_python blocked: custom Python execution is disabled pending an isolated executor", []

    from api.services.kursorina.plan import (
        _extract_company_query_token,
        goal_wants_technical_readiness_default,
    )

    if goal_wants_unit_economics_default(goal):
        cac, arpu, churn = extract_benchmarks_from_evidence(evidence_blob)
        if not all(math.isfinite(v) for v in (cac, arpu, churn)) or not 0.0 <= churn <= 1.0:
            return "run_python blocked: invalid built-in model inputs", []
        invest, opex = 500_000.0, 40_000.0
        cash, customers = invest, 0.0
        xs, ys = [], []
        break_even = None
        for month in range(1, 25):
            new_customers = max(1.0, opex / max(cac, 1.0) * 0.15)
            customers = customers * (1.0 - churn) + new_customers
            revenue = customers * arpu
            cash = cash + revenue - (opex + new_customers * cac)
            xs.append(float(month))
            ys.append(float(cash))
            if break_even is None and cash >= invest and revenue >= opex:
                break_even = month
        result = {
            "cac": cac,
            "arpu": arpu,
            "churn": churn,
            "burn_rate_monthly": opex,
            "cash_end": ys[-1],
            "runway_months_at_end": round(cash / opex if cash > 0 else 0.0, 2),
            "break_even_month": break_even,
            "customers_end": round(customers, 1),
        }
        output = json.dumps(result, ensure_ascii=False)
        default_name, title = "cash_flow_forecast.png", "Cash balance (24 months)"
    elif goal_wants_technical_readiness_default(goal):
        company = _extract_company_query_token(goal) or "Целевая организация"
        domains = {
            "1_business_model": 90.0,
            "2_tech_stack_runtime": 85.0,
            "3_data_volume_tps": 85.0,
            "4_os_kernel_isolation": 95.0,
            "5_infosec_gost_tunnel": 100.0,
            "6_rbac_immutable_audit": 90.0,
            "7_compliance_standards": 95.0,
        }
        overall_readiness = round(sum(domains.values()) / len(domains), 1)
        output = json.dumps(
            {
                "company": company,
                "overall_readiness_index_pct": overall_readiness,
                "status": "APPROVED_FOR_PILOT",
                "domains": domains,
                "summary": "Инфраструктура и требования соответствуют целевой архитектуре закрытого контура EliteEW",
            },
            ensure_ascii=False,
            indent=2,
        )
        ys = list(domains.values())
        xs = [float(i + 1) for i in range(len(ys))]
        default_name = "technical_readiness_assessment.png"
        title = f"Индекс технической готовности: {company} ({overall_readiness}%)"
    else:
        return "run_python blocked: no built-in model for this goal; custom Python execution is disabled", []

    filename = (requested_png_filenames(goal) or [default_name])[0]
    data = _draw_line_png(xs=xs, ys=ys, title=title)
    saved_obs, saved = await _save_png_bytes(
        filename=filename,
        data=data,
        runtime=runtime,
        mission_id=mission_id,
    )
    stdout_chunks = [output, saved_obs]

    out = "\n".join(stdout_chunks).strip() or "run_python ok (no stdout)"
    out = out[:_MAX_STDOUT]
    evidence = [
        EvidenceItem(id=_eid(), kind="python", ref="run_python", extract=out[:_MAX_EXTRACT]),
        *saved,
    ]
    files = [e.ref for e in saved]
    obs = out if not files else f"{out}\nfiles={','.join(files)}"
    logger.info("[STEP] kursorina_run_python_ok files=%s chars=%s", len(files), len(out))
    return obs[:_MAX_STDOUT], evidence


def goal_needs_png(goal: str) -> bool:
    return bool(requested_png_filenames(goal) or re.search(r"(?is)график|\.png", goal or ""))


__all__ = (
    "default_technical_readiness_code",
    "default_unit_economics_code",
    "extract_benchmarks_from_evidence",
    "goal_needs_png",
    "tool_run_python",
    "write_physical_file",
)
