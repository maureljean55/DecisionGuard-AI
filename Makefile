.PHONY: up down logs test test-api test-web lint migrate migrate-prod

up:            ## Start the full stack (builds images)
	docker compose up --build -d

down:          ## Stop the stack (data volumes are kept)
	docker compose down

logs:          ## Follow logs of all services
	docker compose logs -f

migrate:       ## Apply database migrations
	docker compose run --rm migrate

test: test-api test-web

test-api:
	cd apps/api && uv run pytest -q

test-web:
	cd apps/web && npm test

lint:
	cd apps/api && uv run ruff check . && uv run ruff format --check .
	cd apps/web && npm run lint && npm run typecheck

migrate-prod:  ## Apply migrations to the online Supabase database (needs .env.vercel.local)
	@test -f .env.vercel.local || (echo "missing .env.vercel.local" && exit 1)
	cd apps/api && set -a && . ../../.env.vercel.local && set +a && uv run alembic upgrade head
