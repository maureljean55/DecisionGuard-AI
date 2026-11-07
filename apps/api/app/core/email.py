"""Outgoing e-mail.

Development: SMTP to Mailpit (http://localhost:8025). Test: in-memory outbox.
Production: any SMTP relay (credentials via DG_SMTP_*). Sending moves to Celery in M4.
"""

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

from fastapi import BackgroundTasks

from app.core.config import get_settings

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class OutgoingEmail:
    to: str
    subject: str
    body: str
    reply_to: str | None = None


def dispatch_email(tasks: BackgroundTasks, message: OutgoingEmail) -> None:
    """Send after the response when supported, inline on serverless platforms."""
    if get_settings().email_background:
        tasks.add_task(send_email, message)
    else:
        send_email(message)


# Captured messages when DG_ENVIRONMENT=test (inspected by the test suite).
test_outbox: list[OutgoingEmail] = []


def send_email(message: OutgoingEmail) -> None:
    settings = get_settings()
    if settings.environment == "test":
        test_outbox.append(message)
        return

    msg = EmailMessage()
    msg["From"] = settings.email_from
    msg["To"] = message.to
    msg["Subject"] = message.subject
    if message.reply_to:
        msg["Reply-To"] = message.reply_to
    msg.set_content(message.body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password.get_secret_value())
            smtp.send_message(msg)
    except (OSError, smtplib.SMTPException):
        # Never log the body: it contains single-use tokens.
        log.exception("failed to send e-mail", extra={"subject": message.subject})
