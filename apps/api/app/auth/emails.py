"""Localized transactional e-mails. Plain text on purpose (deliverability, no tracking)."""

from urllib.parse import quote

from app.core.config import get_settings
from app.core.email import OutgoingEmail
from app.core.i18n import Locale


def _link(locale: Locale, path: str, token: str) -> str:
    base = get_settings().public_web_url.rstrip("/")
    return f"{base}/{locale}/{path}?token={quote(token)}"


def verification_email(to: str, name: str, token: str, locale: Locale) -> OutgoingEmail:
    link = _link(locale, "verify-email", token)
    if locale == "fr":
        return OutgoingEmail(
            to,
            "Confirmez votre adresse e-mail — DecisionGuard AI",
            f"Bonjour {name},\n\nConfirmez votre adresse e-mail en ouvrant ce lien "
            f"(valable 48 heures) :\n{link}\n\nSi vous n'êtes pas à l'origine de cette "
            "inscription, ignorez ce message.\n\n— DecisionGuard AI",
        )
    return OutgoingEmail(
        to,
        "Confirm your e-mail address — DecisionGuard AI",
        f"Hello {name},\n\nConfirm your e-mail address by opening this link "
        f"(valid for 48 hours):\n{link}\n\nIf you did not sign up, ignore this message."
        "\n\n— DecisionGuard AI",
    )


def password_reset_email(to: str, name: str, token: str, locale: Locale) -> OutgoingEmail:
    link = _link(locale, "reset-password", token)
    if locale == "fr":
        return OutgoingEmail(
            to,
            "Réinitialisation de votre mot de passe — DecisionGuard AI",
            f"Bonjour {name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien "
            f"(valable 1 heure) :\n{link}\n\nSi vous n'avez rien demandé, ignorez ce message : "
            "votre mot de passe actuel reste valable.\n\n— DecisionGuard AI",
        )
    return OutgoingEmail(
        to,
        "Reset your password — DecisionGuard AI",
        f"Hello {name},\n\nTo choose a new password, open this link (valid for 1 hour):\n"
        f"{link}\n\nIf you did not request this, ignore this message: your current password "
        "remains valid.\n\n— DecisionGuard AI",
    )


ROLE_LABELS: dict[Locale, dict[str, str]] = {
    "fr": {
        "owner": "propriétaire",
        "admin": "administrateur",
        "analyst": "analyste",
        "viewer": "lecteur",
    },
    "en": {"owner": "owner", "admin": "administrator", "analyst": "analyst", "viewer": "viewer"},
}


def invitation_email(
    to: str, inviter: str, org_name: str, role: str, token: str, locale: Locale
) -> OutgoingEmail:
    link = _link(locale, "invite", token)
    label = ROLE_LABELS[locale][role]
    if locale == "fr":
        return OutgoingEmail(
            to,
            f"{inviter} vous invite à rejoindre {org_name} sur DecisionGuard AI",
            f"Bonjour,\n\n{inviter} vous invite à rejoindre l'organisation « {org_name} » "
            f"en tant que {label}.\n\nAccepter l'invitation (valable 7 jours) :\n{link}"
            "\n\n— DecisionGuard AI",
        )
    return OutgoingEmail(
        to,
        f"{inviter} invited you to join {org_name} on DecisionGuard AI",
        f"Hello,\n\n{inviter} invited you to join the organization “{org_name}” as {label}."
        f"\n\nAccept the invitation (valid for 7 days):\n{link}\n\n— DecisionGuard AI",
    )
