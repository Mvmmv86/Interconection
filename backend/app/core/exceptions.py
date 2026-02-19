"""Custom exceptions for the application."""

from typing import Any, Optional


class InterconectionException(Exception):
    """Base exception for Interconection application."""

    def __init__(
        self,
        message: str = "An error occurred",
        status_code: int = 500,
        details: Optional[Any] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(self.message)


class AuthenticationError(InterconectionException):
    """Authentication related errors."""

    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message=message, status_code=401)


class AuthorizationError(InterconectionException):
    """Authorization related errors."""

    def __init__(self, message: str = "Not authorized"):
        super().__init__(message=message, status_code=403)


class NotFoundError(InterconectionException):
    """Resource not found errors."""

    def __init__(self, resource: str = "Resource", identifier: Optional[str] = None):
        message = f"{resource} not found"
        if identifier:
            message = f"{resource} with id '{identifier}' not found"
        super().__init__(message=message, status_code=404)


class ValidationError(InterconectionException):
    """Validation errors."""

    def __init__(self, message: str = "Validation error", details: Optional[Any] = None):
        super().__init__(message=message, status_code=422, details=details)


class ConflictError(InterconectionException):
    """Conflict errors (duplicate resources, etc.)."""

    def __init__(self, message: str = "Resource already exists"):
        super().__init__(message=message, status_code=409)


class ExternalAPIError(InterconectionException):
    """External API related errors."""

    def __init__(
        self,
        service: str,
        message: str = "External service error",
        details: Optional[Any] = None,
    ):
        full_message = f"{service}: {message}"
        super().__init__(message=full_message, status_code=502, details=details)


class RateLimitError(InterconectionException):
    """Rate limit exceeded errors."""

    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(message=message, status_code=429)


class IntegrationError(InterconectionException):
    """Integration related errors (exchanges, wallets, etc.)."""

    def __init__(
        self,
        integration_type: str,
        message: str,
        details: Optional[Any] = None,
    ):
        full_message = f"{integration_type} integration error: {message}"
        super().__init__(message=full_message, status_code=400, details=details)
