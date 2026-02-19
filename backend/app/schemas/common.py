"""Common Pydantic schemas."""

from datetime import datetime
from typing import Any, Generic, List, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class BaseSchema(BaseModel):
    """Base schema with common configuration."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class SuccessResponse(BaseSchema):
    """Generic success response."""

    success: bool = True
    message: str = "Operation completed successfully"
    data: Optional[Any] = None


class ErrorResponse(BaseSchema):
    """Error response schema."""

    success: bool = False
    message: str
    error_code: Optional[str] = None
    details: Optional[Any] = None


class PaginatedResponse(BaseSchema, Generic[T]):
    """Paginated response schema."""

    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    @property
    def has_next(self) -> bool:
        return self.page < self.total_pages

    @property
    def has_prev(self) -> bool:
        return self.page > 1


class PaginationParams(BaseSchema):
    """Pagination parameters."""

    page: int = 1
    page_size: int = 20

    @property
    def skip(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class DateRangeParams(BaseSchema):
    """Date range parameters."""

    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class IDResponse(BaseSchema):
    """Response with just an ID."""

    id: UUID
