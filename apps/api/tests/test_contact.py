from app.core.config import get_settings
from app.core.email import test_outbox

MESSAGE = {
    "name": "Awa Diallo",
    "email": "awa@exemple-sarl.example.com",
    "company": "Exemple SARL",
    "topic": "demo",
    "message": "Nous préparons une implantation à Abidjan, pouvez-vous nous montrer l'outil ?",
}


def test_contact_message_is_emailed_with_reply_to(make_client, monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "contact_email", "team@decisionguard.example.com")
    r = make_client().post("/contact", json=MESSAGE)
    assert r.status_code == 202
    sent = test_outbox[-1]
    assert sent.to == "team@decisionguard.example.com"
    assert sent.reply_to == MESSAGE["email"]
    assert "Démonstration" in sent.subject and "Abidjan" in sent.body


def test_contact_unavailable_when_not_configured(make_client, monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "contact_email", None)
    r = make_client().post("/contact", json=MESSAGE)
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "contact.unavailable"


def test_contact_honeypot_sends_nothing(make_client, monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "contact_email", "team@decisionguard.example.com")
    r = make_client().post("/contact", json={**MESSAGE, "website": "http://spam.example.com"})
    assert r.status_code == 202
    assert test_outbox == []


def test_contact_is_rate_limited(make_client, monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "contact_email", "team@decisionguard.example.com")
    c = make_client()
    codes = [c.post("/contact", json=MESSAGE).status_code for _ in range(4)]
    assert codes == [202, 202, 202, 429]


def test_contact_validates_input(make_client, monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "contact_email", "team@decisionguard.example.com")
    r = make_client().post(
        "/contact", json={**MESSAGE, "email": "pas-un-email", "message": "court"}
    )
    assert r.status_code == 422
