# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Backward-compatible re-exports for Phase 3.2 structured think command (discriminated union).
# Related:
# - api/ewa_platform/agentic/kernel/think_command_v1.py
# - api/ewa_platform/agentic/kernel/legacy_adapter.py
# ---

from __future__ import annotations

from api.ewa_platform.agentic.kernel.legacy_adapter import adapt_legacy_think_blob
from api.ewa_platform.agentic.kernel.think_command_v1 import (
    AgenticStructuredThinkOutput,
    ContinuePayload,
    IntervenePayload,
    MutatePayload,
    StructuredDecisionType,
    TerminatePayload,
    ThinkSchemaError,
    extract_json_object,
    parse_structured_think_from_text,
)
from api.ewa_platform.agentic.kernel.think_command_v1 import (
    AgenticStructuredThinkOutput as AgenticThinkOutputV1,
)
from api.ewa_platform.agentic.kernel.think_command_v1 import (
    ContinuePayload as ContinueExecutionPayload,
)
from api.ewa_platform.agentic.kernel.think_command_v1 import (
    IntervenePayload as HumanInterventionPayload,
)
from api.ewa_platform.agentic.kernel.think_command_v1 import (
    MutatePayload as MutatePlanPayload,
)
from api.ewa_platform.agentic.kernel.think_command_v1 import (
    StructuredDecisionType as DecisionType,
)
from api.ewa_platform.agentic.kernel.think_command_v1 import (
    parse_structured_think_from_text as parse_think_v1_from_text,
)

__all__ = [
    "AgenticStructuredThinkOutput",
    "AgenticThinkOutputV1",
    "ContinueExecutionPayload",
    "ContinuePayload",
    "DecisionType",
    "HumanInterventionPayload",
    "IntervenePayload",
    "MutatePayload",
    "MutatePlanPayload",
    "StructuredDecisionType",
    "TerminatePayload",
    "ThinkSchemaError",
    "adapt_legacy_think_blob",
    "extract_json_object",
    "parse_structured_think_from_text",
    "parse_think_v1_from_text",
]
