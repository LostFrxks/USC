from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.core.config import settings


def can_send() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD and settings.SMTP_FROM)


def send_email(to_email: str, subject: str, text: str) -> None:
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text)

    if settings.SMTP_USE_SSL:
        smtp_cls = smtplib.SMTP_SSL
    else:
        smtp_cls = smtplib.SMTP

    with smtp_cls(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
        if (not settings.SMTP_USE_SSL) and settings.SMTP_STARTTLS:
            smtp.starttls()
        smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(msg)
