"""Server-side translations (API error messages and e-mails), FR and EN."""

from typing import Literal

from starlette.requests import Request

Locale = Literal["fr", "en"]
SUPPORTED: tuple[Locale, ...] = ("fr", "en")
DEFAULT: Locale = "fr"

MESSAGES: dict[str, dict[Locale, str]] = {
    "validation_error": {
        "fr": "Certaines données envoyées sont invalides.",
        "en": "Some of the submitted data is invalid.",
    },
    "internal_error": {
        "fr": "Une erreur interne est survenue. Réessayez plus tard.",
        "en": "An internal error occurred. Please try again later.",
    },
    "not_found": {"fr": "Ressource introuvable.", "en": "Resource not found."},
    "rate_limited": {
        "fr": "Trop de tentatives. Réessayez dans quelques minutes.",
        "en": "Too many attempts. Please try again in a few minutes.",
    },
    "csrf_failed": {
        "fr": "Requête refusée (protection CSRF). Rechargez la page.",
        "en": "Request rejected (CSRF protection). Please reload the page.",
    },
    "auth.required": {
        "fr": "Vous devez être connecté.",
        "en": "You must be signed in.",
    },
    "auth.invalid_credentials": {
        "fr": "E-mail ou mot de passe incorrect.",
        "en": "Incorrect e-mail or password.",
    },
    "auth.email_taken": {
        "fr": "Un compte existe déjà avec cette adresse e-mail.",
        "en": "An account already exists with this e-mail address.",
    },
    "auth.weak_password": {
        "fr": "Le mot de passe doit contenir au moins {min} caractères.",
        "en": "Password must be at least {min} characters long.",
    },
    "auth.password_contains_email": {
        "fr": "Le mot de passe ne doit pas contenir votre adresse e-mail.",
        "en": "Password must not contain your e-mail address.",
    },
    "auth.invalid_token": {
        "fr": "Ce lien est invalide ou a expiré.",
        "en": "This link is invalid or has expired.",
    },
    "auth.wrong_password": {
        "fr": "Le mot de passe actuel est incorrect.",
        "en": "Current password is incorrect.",
    },
    "org.forbidden": {
        "fr": "Votre rôle ne permet pas cette action.",
        "en": "Your role does not allow this action.",
    },
    "org.last_owner": {
        "fr": "L'organisation doit conserver au moins un propriétaire.",
        "en": "The organization must keep at least one owner.",
    },
    "org.already_member": {
        "fr": "Cette personne est déjà membre de l'organisation.",
        "en": "This person is already a member of the organization.",
    },
    "contact.unavailable": {
        "fr": "Le formulaire de contact est momentanément indisponible.",
        "en": "The contact form is temporarily unavailable.",
    },
    "quota.exceeded": {
        "fr": "Votre formule permet {limit} analyses par mois : la limite est atteinte.",
        "en": "Your plan allows {limit} analyses per month: the limit has been reached.",
    },
    "analysis.not_collecting": {
        "fr": "Cette analyse n'attend plus de réponses.",
        "en": "This analysis is no longer waiting for answers.",
    },
    "analysis.not_completed": {
        "fr": "Cette analyse n'est pas terminée.",
        "en": "This analysis is not complete.",
    },
    "analysis.not_retryable": {
        "fr": "Seule une analyse en échec peut être relancée.",
        "en": "Only a failed analysis can be retried.",
    },
    "action.owner_not_member": {
        "fr": "Le responsable doit être membre de l'organisation.",
        "en": "The owner must be a member of the organisation.",
    },
    "assistant.unavailable": {
        "fr": "L'assistant n'est pas disponible pour le moment.",
        "en": "The assistant is not available at the moment.",
    },
    "assistant.failed": {
        "fr": "L'assistant n'a pas pu répondre ({code}). Réessayez dans un instant.",
        "en": "The assistant could not answer ({code}). Please try again shortly.",
    },
    "invitation.email_mismatch": {
        "fr": "Cette invitation a été envoyée à une autre adresse e-mail.",
        "en": "This invitation was sent to a different e-mail address.",
    },
}


def negotiate(accept_language: str | None) -> Locale:
    """Pick fr/en from an Accept-Language header (q-values honoured)."""
    if not accept_language:
        return DEFAULT
    ranked: list[tuple[float, int, str]] = []
    for index, part in enumerate(accept_language.split(",")):
        tag, *params = part.strip().split(";")
        q = 1.0
        for p in params:
            if p.strip().startswith("q="):
                try:
                    q = float(p.strip()[2:])
                except ValueError:
                    q = 0.0
        if q > 0:
            ranked.append((-q, index, tag.lower().split("-")[0]))
    for _, _, lang in sorted(ranked):
        if lang in SUPPORTED:
            return lang  # type: ignore[return-value]
    return DEFAULT


def request_locale(request: Request) -> Locale:
    return negotiate(request.headers.get("accept-language"))


def translate(key: str, locale: Locale, **params: object) -> str:
    entry = MESSAGES.get(key)
    if entry is None:
        return key
    return entry[locale].format(**params)
