-- Admin-only "DigiTag" per user+role (location+language+roleChar+5 digits)
CREATE TABLE "UserTag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserTag_tag_key" ON "UserTag"("tag");
CREATE UNIQUE INDEX "UserTag_userId_role_key" ON "UserTag"("userId", "role");

ALTER TABLE "UserTag" ADD CONSTRAINT "UserTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
