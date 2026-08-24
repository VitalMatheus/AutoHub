-- Initial persistence bootstrap. Business models are introduced by their vertical tickets.
-- Keep both UUID generators available to every subsequent migration.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
