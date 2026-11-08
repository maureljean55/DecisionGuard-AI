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

## Authentification et isolation (M2)

**Sessions.** Jeton opaque aléatoire (256 bits) dans un cookie `dg_session` `HttpOnly`, `SameSite=Lax`, `Secure` hors développement. Seul son hachage SHA-256 est stocké (`auth_sessions`). Révocation immédiate (déconnexion, changement ou réinitialisation de mot de passe). Durée : 14 jours (`DG_SESSION_TTL_HOURS`).

**CSRF.** Double-submit : cookie `dg_csrf` lisible par le front, renvoyé dans l'en-tête `X-CSRF-Token` pour toute requête non-GET authentifiée.

**Mots de passe.** Argon2id, 12 caractères minimum, ne doit pas contenir l'identifiant de l'e-mail, 128 maximum (borne le coût de hachage). Temps de réponse identique que le compte existe ou non. « Mot de passe oublié » répond toujours 202 (pas d'énumération). Liens à usage unique (seul le hachage est stocké), seul le dernier lien émis est valable.

**Limitation de débit (Redis).** Connexion : 10 essais / 15 min par e-mail, 50 par IP. Inscription, mot de passe oublié, jetons et invitations également limités.

**Relais web.** Le navigateur ne parle qu'au site (`/api/*` → route handler Next.js → API). Cookies first-party, pas de CORS, l'API peut rester sur un réseau privé.

**Rôles** (`app/core/permissions.py`) : `owner` ⊃ `admin` ⊃ `analyst` ⊃ `viewer`. Un admin ne peut ni créer, ni modifier, ni retirer un propriétaire. Une organisation garde toujours au moins un propriétaire. Un non-membre reçoit **404**, jamais 403 : l'existence des autres entreprises n'est pas révélée.

**Row-Level Security.** L'API se connecte avec le rôle `dg_app` (ni superuser, ni `BYPASSRLS`). Au début de **chaque transaction**, `app.user_id` / `app.org_id` sont fixés par `set_config(..., true)` (portée transaction : aucune fuite via le pool de connexions). Politiques :

| Table | Lecture | Écriture |
|---|---|---|
| `organizations` | contexte org, ou membre | contexte org uniquement |
| `memberships` | contexte org, ou ses propres adhésions | contexte org uniquement |
| `invitations` | contexte org, ou détenteur du jeton | contexte org uniquement |
| `audit_logs` | contexte org | insertion seule (pas d'UPDATE/DELETE accordé) |

Les tables `users`, `auth_sessions`, `user_tokens` sont globales (identité) et ne sont jamais exposées en liste.

**Journal d'audit** : inscription, connexions réussies et échouées, déconnexion, vérification d'e-mail, mots de passe, organisations, rôles, invitations. Consultable par `owner`/`admin`.

**Tests** : `tests/test_tenant_isolation.py` attaque les deux couches (API et SQL brut sans filtre) ; la CI exige leur exécution (`DG_REQUIRE_INTEGRATION=1`).

**Limites connues.** Pas encore d'authentification à deux facteurs ni de SSO (prévus pour Business/Enterprise). L'IP client fiable dépend de la configuration du proxy en production (`FORWARDED_ALLOW_IPS`). Envoi d'e-mails synchrone en tâche de fond FastAPI, à basculer sur Celery au M4.

## Décisions et file d'analyse (M4)

```
Soumission ─► quota mensuel (formule) ─► pré-vérification par règles ─► questions ?
                                                                         │ oui : collecting_info
                                                                         ▼ toutes traitées
                                   pending ─► worker : analyzing → simulating → verifying → reporting ─► completed
                                      ▲            │ échec : retry (backoff 30 s → 30 min), 3 essais max ─► failed
                                      └── reprise des tâches bloquées (heartbeat > délai)
```

- **Pré-vérification** (`app/analyses/precheck.py`) : règles déterministes, sans IA (montant, échéance, périmètre, contexte, alternatives). L'utilisateur répond ou indique « je ne sais pas » : l'information manquante est conservée comme telle.
- **Quotas** (`app/core/plans.py`) : analyses par mois calendaire selon la formule (starter 5, professional 30, business 100, enterprise sur mesure), vérifiés côté serveur (HTTP 402 `quota.exceeded`). Une analyse annulée libère sa place ; une relance n'est pas recomptée.
- **File d'attente en base** plutôt que Celery/Redis : un service de moins, compatible Supabase, transactionnelle et soumise à la RLS. Le worker (`python -m app.worker`) se connecte avec `dg_app` ; seules deux fonctions `SECURITY DEFINER` (`claim_next_analysis`, `recover_stale_analyses`) touchent la file toutes entreprises confondues, et ne renvoient que `(id, organization_id)`. Tout le traitement se fait ensuite dans le contexte RLS de l'entreprise.
- **Pas de faux résultats** : tant qu'aucun moteur n'est configuré (`DG_ANALYSIS_ENGINE=none`), les analyses restent en file avec `waiting_reason = engine_unavailable`. Le moteur multi-agents (M5) implémente `AnalysisPipeline` (`app/worker/pipeline.py`).
- **Hébergement du worker** : il tourne dans Docker en local. En production, Vercel ne peut pas héberger un processus permanent : un petit hôte (Railway, Fly.io, Scaleway…) sera nécessaire à l'arrivée du moteur (M5).

## Backend (`apps/api`)

| Module | Rôle | Milestone |
|---|---|---|
| `app/core` | configuration, logs structurés, sécurité, i18n | M1–M2 |
| `app/db` | moteur SQLAlchemy, session, base déclarative | M1 |
| `app/api` | routes HTTP | M1+ |
| `app/auth`, `app/orgs` | authentification, organisations, membres, invitations, audit | M2 ✅ |
| `app/decisions`, `app/analyses`, `app/worker` | décisions, questions, quotas, file d'analyse | M4 ✅ |
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

## Moteur d'analyse (M5)

`DG_ANALYSIS_ENGINE=agents` branche `AgentPipeline` (`app/agents/orchestrator.py`) sur le worker.

- **Dossier de décision** (`app/agents/brief.py`) : instantané figé de la décision et des réponses,
  rendu dans des balises `<decision>` avec échappement HTML. Le prompt système demande de traiter
  ce contenu comme des données et d'ignorer toute instruction qu'il contiendrait.
- **Agents** (`app/agents/specs.py`) : Finance, Stratégie, Opérations. Même dossier, angle propre,
  prompt système stable par agent et par langue (mis en cache côté fournisseur).
- **Sortie structurée** (`app/agents/schema.py`) : chaque constat porte un type de preuve
  (`fact`, `assumption`, `estimate`, `ai_hypothesis`), une probabilité et un impact de 1 à 5
  (appréciation de l'agent, pas encore le score calculé du M6), un fondement et une atténuation.
- **Étapes** : `analyzing` (appels en parallèle, sans accès base) → `verifying` (normalisation,
  dédoublonnage, bornes) → `reporting` (provenance). Un agent en échec n'annule pas les autres ;
  si tous échouent, l'analyse est relancée (erreur temporaire) ou échoue tout de suite
  (clé invalide, refus).
- **Fournisseurs** (`app/llm/`) : `anthropic` (SDK officiel, `messages.parse`, réflexion
  adaptative, repli serveur en cas de refus) et `mock`, déterministe, fondé sur des règles fixes.
  Les analyses produites par `mock` sont marquées `simulated` et l'interface l'affiche.
- **Stockage** : tables `agent_runs` et `findings` (migration 0006), sous RLS comme le reste.

## Moteur de risque, audit et rapport (M6)

- **Audit** : après les agents spécialisés, l'agent d'audit relit chaque constat numéroté et rend
  un verdict (`supported`, `weak`, `unsupported`) avec une note ; il peut corriger le type de preuve.
  S'il échoue, l'analyse reste valable et les constats sont affichés « non audités ».
- **Indice de risque** (`app/risk/engine.py`, modèle `risk-v1`) : calcul déterministe, sans IA,
  `100 × (0,45 × pic + 0,30 × concentration + 0,15 × étendue + 0,10 × incertitude)`, seuils
  25 / 45 / 65. Les constats `unsupported` sont exclus. Le détail (composantes, matrice 5×5,
  entrées) est stocké dans `analyses.risk_breakdown`.
- **Scénarios** : favorable, médian, défavorable, sévère, obtenus en décalant probabilités et
  impacts ; le simulateur (`POST …/simulate`) recalcule à la demande, sans rien enregistrer.
- **Rapport PDF** (`app/reports/pdf.py`, ReportLab) : généré à la demande depuis les données
  stockées (`GET …/report.pdf`).
- **Rattrapage** : `python -m app.risk.backfill` calcule l'indice des analyses antérieures au M6.
