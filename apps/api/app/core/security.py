"""Password hashing and opaque token generation."""

import hashlib
import hmac
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

# Argon2id with library defaults (OWASP-compliant parameters).
_hasher = PasswordHasher()
# Hash of a random password, used to keep login timing constant when the user does not exist.
_DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(16))

PASSWORD_MAX_LENGTH = 128  # bound hashing cost


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    """Constant-time-ish verification. Pass None for unknown users."""
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def new_token() -> tuple[str, str]:
    """Return (plaintext token for the user, SHA-256 hex digest to store)."""
    token = secrets.token_urlsafe(32)
    return token, hash_token(token)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def tokens_equal(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())
