# Architecture technique

## Vue d'ensemble

```
Navigateur ──► Next.js (apps/web) ──► FastAPI (apps/api) ──► PostgreSQL + pgvector
                                          │
                                          ├──► Redis ──► Workers Celery (analyses, monitoring)   [M4]
                                          └──► Fournisseur LLM (interface + mock)                [M5]
```

## Principes non négociables

1. **Isolation des clients (tenants).** Chaque donnée appartenant à une organisation porte un `organization_id`. Double barrière : filtrage applicatif systématique + Row-Level Security PostgreSQL. Testé explicitement (tentatives d'accès croisé).
2. **Moteur de risque indépendant du LLM.** Les scores (probabilité × impact, seuils, résiduel, corrélations) sont calculés par du Python pur, reproductible et testé. Le LLM propose des évaluations qualitatives argumentées ; il ne calcule jamais le score.
3. **Statut épistémique explicite.** Chaque élément d'analyse est typé : `fact` (sourcé), `assumption`, `estimate`, `ai_hypothesis`. L'agent d'audit rejette les affirmations non étayées.
4. **Documents = données non fiables.** Le contenu des documents n'est jamais interprété comme une instruction ; les agents n'ont aucun outil à effet de bord.
5. **Pas de secret dans le code.** Configuration exclusivement par variables d'environnement (`DG_*`) ; la production refuse de démarrer avec des valeurs par défaut.
6. **Bilingue natif.** Interface FR/EN (routes `/fr`, `/en`), messages API localisés, sorties d'agents et rapports générés dans la langue de l'organisation.
7. **Humain dans la boucle.** La plateforme recommande, ne décide ni n'exécute jamais.

## Backend (`apps/api`)

| Module | Rôle | Milestone |
|---|---|---|
| `app/core` | configuration, logs structurés, sécurité, i18n | M1–M2 |
| `app/db` | moteur SQLAlchemy, session, base déclarative | M1 |
| `app/api` | routes HTTP | M1+ |
| `app/auth`, `app/tenancy` | authentification, organisations, RBAC, RLS | M2 |
| `app/decisions` | décisions, analyses, statuts | M4 |
| `app/llm` | interface fournisseur, mock, suivi de consommation | M5 |
| `app/agents` | orchestrateur LangGraph, agents spécialisés, audit | M5, M7 |
| `app/risk_engine` | calculs déterministes, heatmap, corrélations | M6 |
| `app/documents` | upload, extraction, chunking, embeddings, RAG | M8 |
| `app/reports` | rapports PDF FR/EN | M9 |
| `app/monitoring` | surveillance continue, alertes | M10 |
| `app/billing` | formules, quotas, (paiement en ligne plus tard) | M11 |

Choix : SQLAlchemy **synchrone** + psycopg 3 (mêmes sessions côté API et workers Celery, plus simple à raisonner). Les routes FastAPI synchrones tournent dans un pool de threads.

## Frontend (`apps/web`)

- Next.js 16 (App Router, `cacheComponents`), React 19, Tailwind 4.
- i18n natif Next.js : segment racine `app/[lang]`, `src/proxy.ts` redirige selon cookie `dg_locale` puis `Accept-Language`. Dictionnaires typés : une clé manquante en anglais est une erreur de compilation.
- Le serveur Next appelle l'API via `API_URL` (réseau interne Docker).
- Jetons de design (bleu nuit, anthracite, bleu atténué, couleurs de risque) dans `globals.css`.

## Base de données

Migrations Alembic dans `apps/api/migrations/versions`. Extensions activées : `vector` (pgvector), `citext`, `pgcrypto`. Le schéma métier arrive à partir de M2 — voir [roadmap.md](roadmap.md).

## Décisions reportées

- **Stockage objet** (documents, rapports) : choix entre S3 compatible managé (UE) et alternative auto-hébergée, à trancher en M8. MinIO n'est pas retenu par défaut à cause de l'évolution de sa distribution communautaire.
- **Paiement en ligne** : facturation manuelle au départ ; Stripe (Europe) puis Mobile Money (Afrique) derrière une interface commune, en fin de feuille de route.
