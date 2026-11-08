# Feuille de route

## Phase MVP — parcours complet utilisable par des clients pilotes

| # | Milestone | Statut |
|---|---|---|
| M1 | Fondations : monorepo, Docker, API + santé, frontend FR/EN, CI, docs | ✅ Terminé |
| M2 | Authentification, organisations, membres, rôles, isolation (RLS), journal d'audit | ✅ Terminé |
| M3 | Espace entreprise responsive (ordinateur/tablette/mobile, PWA) : tableau de bord, navigation, gestion d'équipe, paramètres | ✅ Terminé |
| M4 | Soumission de décision, questions complémentaires, analyses asynchrones (Celery), statuts | 🟡 En cours : décisions (création, brouillon, soumission, archivage) livrées |
| M5 | Orchestrateur LangGraph, interface LLM + mock, agents Financier / Stratégique / Opérationnel | |
| M6 | Moteur de risque déterministe, heatmap 5×5, agent d'audit, scénarios, rapport PDF de base | |

## Phase V1 — commercialisable

| # | Milestone |
|---|---|
| M7 | Agents Juridique (RGPD, OHADA, lois nationales), Cyber, Humain, Prospectif |
| M8 | Intelligence documentaire : upload sécurisé, extraction, pgvector, RAG avec sources |
| M9 | Recommandations, feuille de route d'atténuation, rapports PDF complets FR/EN |

## Phase V1.5 — lancement

| # | Milestone |
|---|---|
| M10 | Surveillance continue et alertes |
| M11 | Formules et quotas (facturation manuelle → Stripe → Mobile Money), administration plateforme |
| M12 | Durcissement sécurité, performance, tests E2E, déploiement production (hébergement UE) |

## Note sur la facturation

Au lancement, les clients pilotes sont facturés par virement ; la formule est activée depuis l'administration. Les quotas sont appliqués côté serveur dès M4. Le paiement en ligne vient plus tard.
