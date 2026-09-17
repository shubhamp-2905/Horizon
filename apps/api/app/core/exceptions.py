from typing import Any, Dict, Optional
from fastapi import HTTPException, status


class HorizonException(Exception):
    """Base exception for all Horizon domain exceptions."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class EntityNotFoundException(HorizonException):
    """Raised when an expected domain entity does not exist."""
    pass


class InvalidOperationException(HorizonException):
    """Raised when an operation violates domain invariants."""
    pass


class InsufficientTokenBalanceException(HorizonException):
    """Raised when a contributor attempts to stake or transfer tokens exceeding available balance."""
    pass
