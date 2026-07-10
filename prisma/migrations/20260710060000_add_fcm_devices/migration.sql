-- CreateTable
CREATE TABLE "FcmDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FcmDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FcmDevice_token_key" ON "FcmDevice"("token");

-- CreateIndex
CREATE INDEX "FcmDevice_userId_idx" ON "FcmDevice"("userId");

-- AddForeignKey
ALTER TABLE "FcmDevice" ADD CONSTRAINT "FcmDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
