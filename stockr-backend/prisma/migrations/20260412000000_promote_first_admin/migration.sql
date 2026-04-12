-- Promote the first-created user to admin if no admin exists yet
-- (fixes existing installations created before the role system was added)
UPDATE "User" SET "role" = 'admin'
WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" WHERE "role" = 'admin');
