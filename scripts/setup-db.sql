-- Run as a PostgreSQL superuser to bootstrap local demo DB
-- Example: psql -U postgres -f scripts/setup-db.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jithu') THEN
    CREATE ROLE jithu LOGIN PASSWORD 'jithu_dev_password';
  END IF;
END
$$;

SELECT 'CREATE DATABASE jithu_buy OWNER jithu'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'jithu_buy')\gexec

GRANT ALL PRIVILEGES ON DATABASE jithu_buy TO jithu;
