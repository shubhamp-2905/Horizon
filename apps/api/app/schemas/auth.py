from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserRegisterRequest(BaseModel):
    email: EmailStr = Field(..., examples=["contributor@horizon.dev"])
    username: str = Field(..., min_length=3, max_length=64, examples=["scout_alpha"])
    password: str = Field(..., min_length=6, max_length=128, examples=["SecureP@ss123"])
    display_name: Optional[str] = Field(None, max_length=128, examples=["Scout Alpha"])
    role: Optional[str] = Field("contributor", examples=["contributor"])


class UserLoginRequest(BaseModel):
    email_or_username: str = Field(..., examples=["scout_alpha"])
    password: str = Field(..., examples=["SecureP@ss123"])


class UserProfileResponse(BaseModel):
    id: str
    email: str
    username: str
    display_name: Optional[str] = None
    role: str
    status: str
    available_tokens: int = 0
    locked_tokens: int = 0
    total_tokens: int = 0
    reputation_score: float = 100.0


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse


class PushTokenRegisterRequest(BaseModel):
    push_token: str = Field(..., examples=["ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"])
    device_type: Optional[str] = Field("android", examples=["android", "ios", "web"])
