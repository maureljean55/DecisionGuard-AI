import re
import secrets
import unicodedata
import uuid

from sqlalchemy.orm import Session

from app.auth.schemas import OrganizationCreate
from app.core.permissions import Role
from app.db.session import set_rls_context
from app.models import Membership, Organization, User


def slugify(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    base = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")[:60] or "org"
    # Random suffix: uniqueness without having to read other tenants' slugs (RLS hides them).
    return f"{base}-{secrets.token_hex(3)}"


def create_organization(db: Session, owner: User, data: OrganizationCreate) -> Organization:
    org = Organization(
        # Explicit id: the RLS WITH CHECK clause needs it in the context before the INSERT.
        id=uuid.uuid4(),
        name=data.name.strip(),
        slug=slugify(data.name),
        country_code=data.country_code,
        currency=data.currency,
        default_locale=data.default_locale,
        plan="starter",
    )
    set_rls_context(db, user_id=owner.id, org_id=org.id)
    db.add(org)
    db.flush()
    db.add(Membership(organization_id=org.id, user_id=owner.id, role=Role.OWNER))
    db.flush()
    return org
