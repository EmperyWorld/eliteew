# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   UGS generation HTTP surface: start generation, SSE stream, status, result, cancel.
# Invariants:
#   - Idempotency key resolution matches ``documentation/platform/docker-re_doc/UGS-IDEMPOTENCY.md``.
#   - Status/result reads are owner-scoped; a leaked request UUID must not expose another user's payload.
# Related:
#   - api/services/ugs/unified_generation_service.py
#   - api/routers/ugs/deps.py
# ---
"""UGS generation routes."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import (  # type: ignore[import-untyped]
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
)
from fastapi.responses import StreamingResponse  # type: ignore[import-untyped]

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.routers.ugs.common import _sse_message
from api.routers.ugs.deps import _idempotency_key_from_body_or_headers, get_ugs_service, logger
from api.schemas.ugs import (
    GenerationRequestCreate,
    GenerationResponse,
    GenerationResultResponse,
    GenerationStatusResponse,
)
from api.services.ugs.unified_generation_service import UnifiedGenerationService


def register_generation_routes(router: APIRouter) -> None:
    """Attach generation endpoints to the shared UGS router."""

    @router.post(
        "/generate",
        response_model=GenerationResponse,
        summary="Start Content Generation",
        description="Start generation of content using specified type and input data",
    )
    async def generate_content(
        request: GenerationRequestCreate,
        http_request: Request,
        background_tasks: BackgroundTasks,  # noqa: ARG001
        user: User = Depends(require_oauth2_user),  # noqa: B008
        ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
    ) -> GenerationResponse:
        """
        🔥 START CONTENT GENERATION 🔥

        Generate content using the Unified Generation System.

        - **type_key**: Generation type (e.g., "text_chat", "image_banner")
        - **input_data**: Input parameters for generation
        - **project_id**: Optional project association
        - **priority**: Priority level (1-10, higher = more urgent)
        """
        try:
            idem = _idempotency_key_from_body_or_headers(request.idempotency_key, http_request)
            result = await ugs_service.generate(
                user_id=str(user.id),
                type_key=request.type_key,
                input_data=request.input_data,
                project_id=str(request.project_id) if request.project_id is not None else None,
                company_id=str(request.company_id) if request.company_id is not None else None,
                priority=request.priority,
                idempotency_key=idem,
            )

            return GenerationResponse(**result)

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except (OSError, RuntimeError) as e:
            logger.exception("Generation failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e

    @router.post(
        "/generate/stream",
        summary="Start Content Generation (SSE stream)",
        description="Start generation and stream progress/keep-alive until result or error. Connection is not closed until the image (or result) is ready.",
    )
    async def generate_content_stream(
        request: GenerationRequestCreate,
        http_request: Request,
        user: User = Depends(require_oauth2_user),  # noqa: B008
        ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
    ) -> StreamingResponse:
        """
        SSE stream: keep-alive and progress while ComfyUI (or other provider) runs.
        Final event is either result (with image link/content_id) or error.
        """

        idem = _idempotency_key_from_body_or_headers(request.idempotency_key, http_request)

        async def event_stream() -> Any:
            try:
                start_payload = await ugs_service.start_generation_for_stream(
                    user_id=str(user.id),
                    type_key=request.type_key,
                    input_data=request.input_data or {},
                    project_id=str(request.project_id) if request.project_id is not None else None,
                    company_id=str(request.company_id) if request.company_id is not None else None,
                    priority=request.priority,
                    idempotency_key=idem,
                )
            except ValueError as e:
                yield _sse_message("error", {"error": str(e)})
                return
            if start_payload.get("status") == "completed":
                yield _sse_message("result", start_payload)
                return
            request_id = start_payload.get("request_id")
            if not request_id:
                yield _sse_message("error", {"error": "No request_id returned"})
                return
            yield _sse_message(
                "started", {"request_id": request_id, "status": start_payload.get("status", "processing")}
            )
            async for ev in ugs_service.stream_generation_events(
                request_id, str(user.id), poll_interval=2.5, keep_alive_interval=8.0
            ):
                event_type = ev.get("event") or "message"
                yield _sse_message(event_type, ev)

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )

    @router.get(
        "/status/{request_id}",
        response_model=GenerationStatusResponse,
        summary="Get Generation Status",
        description="Get the current status and progress of a generation request",
    )
    async def get_generation_status(
        request_id: UUID,
        user: User = Depends(require_oauth2_user),  # noqa: B008
        ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
    ) -> GenerationStatusResponse:
        """
        🔥 GET GENERATION STATUS 🔥

        Retrieve the current status of a generation request.

        - **request_id**: UUID of the generation request
        """
        try:
            result = await ugs_service.get_status(str(request_id), user_id=str(user.id))
            return GenerationStatusResponse(**result)

        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
        except PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e)) from e
        except (OSError, RuntimeError) as e:
            logger.exception("Status check failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e

    @router.get(
        "/result/{request_id}",
        response_model=GenerationResultResponse,
        summary="Get Generation Result",
        description="Get the final result of a completed generation request",
    )
    async def get_generation_result(
        request_id: UUID,
        user: User = Depends(require_oauth2_user),  # noqa: B008
        ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
    ) -> GenerationResultResponse:
        """
        🔥 GET GENERATION RESULT 🔥

        Retrieve the result of a completed generation.

        - **request_id**: UUID of the generation request
        """
        try:
            result = await ugs_service.get_result(str(request_id), user_id=str(user.id))
            return GenerationResultResponse(**result)

        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
        except PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e)) from e
        except (OSError, RuntimeError) as e:
            logger.exception("Result retrieval failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e

    @router.delete(
        "/cancel/{request_id}",
        summary="Cancel Generation",
        description="Cancel a running or pending generation request",
    )
    async def cancel_generation(
        request_id: UUID,
        user: User = Depends(require_oauth2_user),  # noqa: B008
        ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
    ) -> dict[str, Any]:
        """
        🔥 CANCEL GENERATION 🔥

        Cancel a generation request if it's still running. Only the owner can cancel.

        - **request_id**: UUID of the generation request
        """
        try:
            return await ugs_service.cancel_generation(str(request_id), user_id=str(user.id))

        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
        except PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e)) from e
        except (OSError, RuntimeError) as e:
            logger.exception("Cancellation failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e
