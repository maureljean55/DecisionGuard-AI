"""Public contact form: messages are e-mailed to the team, the address is never exposed."""

from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Request, status
from pydantic import BaseModel, EmailStr, Field

from app.core import audit, ratelimit
from app.core.config import get_settings
from app.core.email import OutgoingEmail, dispatch_email
from app.core.errors import AppError

router = APIRouter(tags=["contact"])

Topic = Literal["pilot", "demo", "partnership", "other"]
TOPIC_LABEL: dict[str, str] = {
    "pilot": "Accès pilote",
    "demo": "Démonstration",
    "partnership": "Partenariat",
    "other": "Autre",
}


class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    company: str = Field(default="", max_length=200)
    topic: Topic = "other"
    message: str = Field(min_length=10, max_length=5000)
    # Honeypot: hidden field that humans leave empty; bots tend to fill every input.
    website: str = Field(default="", max_length=200)


@router.post("/contact", status_code=status.HTTP_202_ACCEPTED)
def contact(body: ContactRequest, request: Request, tasks: BackgroundTasks) -> None:
    to = get_settings().contact_email
    if not to:
        raise AppError(status.HTTP_503_SERVICE_UNAVAILABLE, "contact.unavailable")
    ip = audit.client_ip(request) or "unknown"
    ratelimit.hit("contact:ip", ip, limit=5, window_seconds=3600)
    ratelimit.hit("contact:email", body.email.lower(), limit=3, window_seconds=3600)
    if body.website:  # bot: accept silently, send nothing
        return
    text = (
        f"Nouveau message depuis le site DecisionGuard AI\n\n"
        f"Sujet : {TOPIC_LABEL[body.topic]}\n"
        f"Nom : {body.name}\n"
        f"E-mail : {body.email}\n"
        f"Entreprise : {body.company or '-'}\n\n"
        f"{body.message}\n"
    )
    dispatch_email(
        tasks,
        OutgoingEmail(
            to=to,
            subject=f"[DecisionGuard] {TOPIC_LABEL[body.topic]} — {body.name}",
            body=text,
            reply_to=body.email,
        ),
    )
