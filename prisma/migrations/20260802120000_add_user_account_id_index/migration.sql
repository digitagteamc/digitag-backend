-- Account -> User is a one-to-many lookup (login / switch-role read "all
-- Users for this Account"), but accountId had no index — it was falling
-- back to a seq scan. Cheap to add now, matters once Account rows scale.
CREATE INDEX "User_accountId_idx" ON "User"("accountId");
