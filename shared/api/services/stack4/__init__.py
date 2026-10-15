# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Package root for Stack4 document processing HTTP clients.
# Invariants:
# - Consumers import Stack4DocumentGateway from this package only.
# Related:
# - api/services/stack4/document_gateway.py
# ---

from api.services.stack4.document_gateway import (
    Stack4DocumentGateway,
    Stack4GatewayError,
    Stack4ServiceUnavailable,
    get_stack4_document_gateway,
    unwrap_gotenberg_output,
)

__all__ = [
    "Stack4DocumentGateway",
    "Stack4GatewayError",
    "Stack4ServiceUnavailable",
    "get_stack4_document_gateway",
    "unwrap_gotenberg_output",
]
