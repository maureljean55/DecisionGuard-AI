#!/bin/sh
# Runs once, on first initialisation of the Postgres volume.
# Creates the unprivileged role used by the application at runtime.
# - POSTGRES_USER (owner) runs migrations and owns the tables.
# - dg_app has no SUPERUSER / BYPASSRLS: Row-Level Security policies always apply to it.
# Table-level grants are applied by the Alembic migrations, in every database.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$DG_APP_DB_PASSWORD" -v owner="$POSTGRES_USER" -v db="$POSTGRES_DB" <<-'EOSQL'
	CREATE ROLE dg_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
	GRANT CONNECT ON DATABASE :"db" TO dg_app;
	-- Database used by the integration test suite, same isolation model.
	CREATE DATABASE decisionguard_test OWNER :"owner";
	GRANT CONNECT ON DATABASE decisionguard_test TO dg_app;
EOSQL
