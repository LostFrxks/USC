from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.cache.redis_cache import get_redis_client
from app.core.config import settings


class AuthGuardError(RuntimeError):
    def __init__(self, reason_code: str, *, lockout_seconds: int | None = None, captcha_required: bool = False):
        self.reason_code = reason_code
        self.lockout_seconds = lockout_seconds
        self.captcha_required = captcha_required
        super().__init__(reason_code)


def _safe(s: str | None) -> str:
    if not s:
        return "_"
    return (
        str(s)
        .strip()
        .lower()
        .replace(" ", "_")
        .replace("/", "_")
        .replace(":", "_")
        .replace("|", "_")
    ) or "_"


def _now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())


@dataclass
class GuardContext:
    scope: str
    target: str
    ip: str

    @property
    def key_base(self) -> str:
        return f"sec:ag:{_safe(self.scope)}:{_safe(self.target)}:{_safe(self.ip)}"


class AuthGuard:
    """
    Tracks auth failures and escalates lockout:
    15m -> 1h -> 24h (within a 24h offense window).
    """

    def _client(self):
        return get_redis_client()

    def _lock_key(self, ctx: GuardContext) -> str:
        return f"{ctx.key_base}:lock"

    def _fails_key(self, ctx: GuardContext) -> str:
        return f"{ctx.key_base}:fails"

    def _offense_key(self, ctx: GuardContext) -> str:
        return f"{ctx.key_base}:offense"

    def _captcha_key(self, ctx: GuardContext) -> str:
        return f"{ctx.key_base}:captcha_required"

    def _captcha_ok(self, token: str | None) -> bool:
        # pluggable stub provider for MVP
        if settings.CAPTCHA_PROVIDER == "stub":
            return bool(token) and token == settings.CAPTCHA_STUB_TOKEN
        return False

    def precheck(self, *, scope: str, target: str, ip: str, captcha_token: str | None = None) -> None:
        c = self._client()
        if c is None:
            return
        ctx = GuardContext(scope=scope, target=target, ip=ip)

        lock_ttl = int(c.ttl(self._lock_key(ctx)) or 0)
        if lock_ttl > 0:
            raise AuthGuardError("locked_out", lockout_seconds=lock_ttl, captcha_required=True)

        captcha_required = c.get(self._captcha_key(ctx))
        if captcha_required:
            if not self._captcha_ok(captcha_token):
                raise AuthGuardError("captcha_required", captcha_required=True)

    def success(self, *, scope: str, target: str, ip: str) -> None:
        c = self._client()
        if c is None:
            return
        ctx = GuardContext(scope=scope, target=target, ip=ip)
        c.delete(self._fails_key(ctx), self._lock_key(ctx), self._captcha_key(ctx))

    def failure(self, *, scope: str, target: str, ip: str) -> None:
        c = self._client()
        if c is None:
            return
        ctx = GuardContext(scope=scope, target=target, ip=ip)

        fails_key = self._fails_key(ctx)
        fails = int(c.incr(fails_key))
        c.expire(fails_key, int(settings.AUTH_FAIL_WINDOW_SECONDS))

        if fails < int(settings.AUTH_FAIL_THRESHOLD):
            return

        offense_key = self._offense_key(ctx)
        offense_level = int(c.incr(offense_key))
        c.expire(offense_key, int(settings.AUTH_FAIL_WINDOW_SECONDS))
        c.delete(fails_key)

        if offense_level <= 1:
            duration = int(settings.AUTH_LOCKOUT_STEP1_SECONDS)
        elif offense_level == 2:
            duration = int(settings.AUTH_LOCKOUT_STEP2_SECONDS)
        else:
            duration = int(settings.AUTH_LOCKOUT_STEP3_SECONDS)

        c.setex(self._lock_key(ctx), duration, str(_now_ts() + duration))
        c.setex(self._captcha_key(ctx), int(settings.CAPTCHA_REQUIRED_TTL_SECONDS), "1")

    def lockout_ttl(self, *, scope: str, target: str, ip: str) -> int:
        c = self._client()
        if c is None:
            return 0
        ctx = GuardContext(scope=scope, target=target, ip=ip)
        return max(0, int(c.ttl(self._lock_key(ctx)) or 0))


auth_guard = AuthGuard()

