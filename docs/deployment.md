# Déploiement en ligne

## Vue d'ensemble

```
Navigateur ──► Vercel « decisionguard »      https://decisionguard.vercel.app   (Next.js, cdg1 Paris)
                 │  relais /api/* (+ IP client signée par DG_RELAY_SECRET)
                 ▼
               Vercel « decisionguard-api »  https://decisionguard-api.vercel.app (FastAPI, cdg1 Paris)
                 │  rôle dg_app, pooler transactionnel :6543
                 ▼
               Supabase « decisionguard »    ref fgntaburuzxjylumdkec (PostgreSQL 17, eu-west-3 Paris)
```

- **Déploiement automatique** : chaque push sur `main` redéploie les deux projets Vercel (dossiers racine `apps/web` et `apps/api`).
- **Environnement** : `DG_ENVIRONMENT=staging` tant qu'aucun fournisseur LLM réel n'est configuré (la production refuse le mode `mock`).
- **Secrets** : uniquement dans les variables d'environnement Vercel. Copie locale dans `.env.vercel.local` (racine du dépôt, exclue de git, permissions 600). Ne jamais la partager.

## Base de données (Supabase)

| Rôle | Usage | Connexion |
|---|---|---|
| `postgres` (propriétaire) | migrations uniquement | pooler session `aws-1-eu-west-3.pooler.supabase.com:5432`, utilisateur `postgres.<ref>` |
| `dg_app` (sans privilèges, soumis à RLS) | API en production | pooler transaction `…:6543`, utilisateur `dg_app.<ref>` |

En serverless, l'API utilise `DG_DB_POOL=null` (pas de pool côté fonction ; c'est Supavisor qui mutualise) et `DG_DB_DISABLE_PREPARED_STATEMENTS=true` (obligatoire en mode transaction). Le contexte RLS étant fixé **par transaction**, il est compatible avec ce mode.

**API publique de Supabase (Data API / PostgREST).** La migration `0003` retire tous les droits aux rôles `anon` et `authenticated`, y compris sur les tables futures, et active la RLS sur toutes les tables. Vérifié en ligne : toute requête REST avec la clé publique répond `401 / 42501`. Recommandé en plus : *Project Settings → Data API → désactiver*.

### Appliquer une migration en production

À faire **avant** de pousser un changement de schéma (sinon la nouvelle API démarre sur l'ancien schéma) :

```bash
make migrate-prod
```

## Variables d'environnement

**decisionguard-api**

| Variable | Valeur |
|---|---|
| `DG_ENVIRONMENT` | `staging` |
| `DG_SECRET_KEY` | aléatoire (64+ caractères) |
| `DG_DATABASE_URL` | `postgresql+psycopg://dg_app.<ref>:…@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?sslmode=require` |
| `DG_DB_POOL` | `null` |
| `DG_DB_DISABLE_PREPARED_STATEMENTS` | `true` |
| `DG_EMAIL_BACKGROUND` | `false` (envoi pendant la requête : le travail après réponse n'est pas garanti en serverless) |
| `DG_RELAY_SECRET` | aléatoire, **identique** côté web |
| `DG_PUBLIC_WEB_URL` | `https://decisionguard.vercel.app` |
| `DG_LOG_JSON` | `true` |
| `DG_LLM_PROVIDER` | `mock` (en attendant une clé) |
| `DG_SMTP_*`, `DG_EMAIL_FROM` | Brevo, voir ci-dessous |
| `DG_CONTACT_EMAIL` | destinataire du formulaire de contact (jamais affiché sur le site) |

**decisionguard (web)** : `API_URL=https://decisionguard-api.vercel.app`, `DG_RELAY_SECRET`.

## E-mails (Brevo)

Tant que ces variables ne sont pas renseignées, l'inscription et la connexion fonctionnent mais **aucun e-mail n'est envoyé** (échec journalisé).

```bash
cd apps/api
vercel env add DG_SMTP_HOST production        # smtp-relay.brevo.com
vercel env add DG_SMTP_PORT production        # 587
vercel env add DG_SMTP_USE_TLS production     # true
vercel env add DG_SMTP_USERNAME production    # login SMTP Brevo (xxx@smtp-brevo.com)
vercel env add DG_SMTP_PASSWORD production    # clé SMTP Brevo
vercel env add DG_EMAIL_FROM production       # DecisionGuard AI <no-reply@votre-domaine>
```

Puis redéployer (un push suffit). L'adresse d'expédition doit être validée dans Brevo (*Senders*), idéalement sur votre propre domaine (SPF/DKIM).

## Limites actuelles de cet hébergement

- Les fonctions Vercel (Hobby) sont limitées à 300 s : suffisant pour l'API, **pas** pour les analyses multi-agents longues (M4–M5), qui nécessiteront un worker dédié.
- Les projets Supabase gratuits sont mis en pause après une semaine d'inactivité.
- Domaine personnalisé : à configurer dans Vercel (*Settings → Domains*) puis mettre à jour `DG_PUBLIC_WEB_URL`.
