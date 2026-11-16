"""Domain exceptions and FastAPI handlers. Every error uses one JSON shape:
{"error": {"code": str, "message": str, "details": any | null}}
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError

logger = logging.getLogger(__name__)


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, details=None):
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class ValidationFailed(AppError):
    status_code = 422
    code = "validation_error"


class AIUnavailableError(AppError):
    status_code = 503
    code = "ai_unavailable"


class AIProviderError(AppError):
    status_code = 502
    code = "ai_provider_error"


def _body(code: str, message: str, details=None) -> dict:
    return {"error": {"code": code, "message": message, "details": details}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content=_body(exc.code, exc.message, exc.details))

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        errors = exc.errors()
        first = errors[0] if errors else {}
        loc = ".".join(str(p) for p in first.get("loc", []) if p != "body")
        message = f"{loc}: {first.get('msg')}" if loc else str(first.get("msg", "Invalid request"))
        safe = [{"loc": list(e.get("loc", [])), "msg": e.get("msg")} for e in errors]
        return JSONResponse(status_code=422, content=_body("validation_error", message, safe))

    @app.exception_handler(IntegrityError)
    async def _integrity(_: Request, exc: IntegrityError):
        logger.warning("Integrity error: %s", exc.orig)
        return JSONResponse(
            status_code=409,
            content=_body("conflict", "That change conflicts with existing data."),
        )

    @app.exception_handler(OperationalError)
    async def _operational(_: Request, exc: OperationalError):
        logger.error("Database operational error: %s", exc)
        return JSONResponse(
            status_code=503,
            content=_body("database_unavailable", "The database is not reachable right now. Please try again."),
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        logger.exception("Unhandled error: %s", exc)
        return JSONResponse(
            status_code=500,
            content=_body("internal_error", "Something went wrong on our side. Please try again."),
        )
