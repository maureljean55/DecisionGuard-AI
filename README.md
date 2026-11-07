# DecisionGuard AI

Plateforme SaaS d'intelligence des risques décisionnels : une IA multi-agents analyse une décision d'entreprise, évalue les risques avec un moteur de calcul déterministe, simule des scénarios, vérifie ses propres conclusions et produit un rapport d'aide à la décision (FR/EN).

> **Statut : Milestone 1 (fondations).** Voir [docs/roadmap.md](docs/roadmap.md).

## Prérequis

- Docker Desktop (démarré)
- [uv](https://docs.astral.sh/uv/) — gère Python 3.13 pour le backend
- Node.js 24+

## Démarrage rapide

```bash
cp .env.example .env        # puis renseigner DG_SECRET_KEY
make up                     # = docker compose up --build -d
```

| Service | URL |
|---|---|
| Site web | http://localhost:3000 (redirige vers `/fr` ou `/en`) |
| API | http://localhost:8000 |
| Documentation API (dev) | http://localhost:8000/docs |
| Santé | http://localhost:8000/health |

Arrêter : `make down` (les données sont conservées dans des volumes Docker).

## Développement sans Docker pour les applis

```bash
docker compose up -d postgres redis      # uniquement les services
cd apps/api && uv sync && uv run alembic upgrade head && uv run fastapi dev app/main.py
cd apps/web && npm install && npm run dev
```

## Tests et qualité

```bash
make test     # tests backend (pytest) + frontend (vitest)
make lint     # ruff, eslint, typecheck
```

## Structure

```
apps/api/    Backend FastAPI (Python 3.13, SQLAlchemy, Alembic)
apps/web/    Frontend Next.js 16 (TypeScript, Tailwind, i18n FR/EN)
docs/        Architecture, feuille de route, décisions techniques
```

Voir [docs/architecture.md](docs/architecture.md).

## Fournisseur LLM

Par défaut `DG_LLM_PROVIDER=mock` : un fournisseur hors-ligne, déterministe, dont les sorties sont **explicitement marquées comme simulées**. Il sert au développement et aux tests. Il est refusé au démarrage en production.
