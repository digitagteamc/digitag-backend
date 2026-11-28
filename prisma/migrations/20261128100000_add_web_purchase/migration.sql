-- One-time Razorpay purchases from the website /subscription page.
-- CreateEnum
CREATE TYPE "WebPurchaseType" AS ENUM ('PACKAGE', 'SERVICE');

-- CreateEnum
CREATE TYPE "WebPurchaseStatus" AS ENUM ('CREATED', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "WebPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemType" "WebPurchaseType" NOT NULL,
    "itemKey" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "baseAmount" INTEGER NOT NULL,
    "gstAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "WebPurchaseStatus" NOT NULL DEFAULT 'CREATED',
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "gstin" TEXT,
    "businessName" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebPurchase_razorpayOrderId_key" ON "WebPurchase"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "WebPurchase_razorpayPaymentId_key" ON "WebPurchase"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "WebPurchase_userId_status_idx" ON "WebPurchase"("userId", "status");

-- CreateIndex
CREATE INDEX "WebPurchase_status_createdAt_idx" ON "WebPurchase"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "WebPurchase" ADD CONSTRAINT "WebPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
