-- Prevents a repeat of the duplicate-profile bug (accounts ending up with two
-- User rows for the same role, one of which silently has no profile
-- attached). A plain unique index can't be used because Prudvi's own
-- already-deleted duplicate rows share (accountId, role) and must not be
-- touched -- so this is scoped to non-deleted rows only. Prisma's schema
-- can't express a partial index, so it's applied here directly and left
-- undeclared in schema.prisma, matching this project's existing convention
-- for anything beyond Prisma's declarative capabilities.
CREATE UNIQUE INDEX "User_accountId_role_live_key"
  ON "User" ("accountId", "role")
  WHERE "accountId" IS NOT NULL AND "status" != 'DELETED';
