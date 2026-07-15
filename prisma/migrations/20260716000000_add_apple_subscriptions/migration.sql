-- iOS must use StoreKit (Apple 3.1.1), Android/web keep Razorpay — Subscription
-- rows now carry a provider tag, and the Razorpay columns become nullable so
-- an Apple-sourced row doesn't need fake Razorpay ids.
CREATE TYPE "SubscriptionProvider" AS ENUM ('RAZORPAY', 'APPLE');

ALTER TABLE "Subscription" ADD COLUMN "provider" "SubscriptionProvider" NOT NULL DEFAULT 'RAZORPAY';
ALTER TABLE "Subscription" ADD COLUMN "appleOriginalTransactionId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "appleTransactionId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "appleProductId" TEXT;

ALTER TABLE "Subscription" ALTER COLUMN "razorpaySubscriptionId" DROP NOT NULL;
ALTER TABLE "Subscription" ALTER COLUMN "razorpayPlanId" DROP NOT NULL;

CREATE UNIQUE INDEX "Subscription_appleOriginalTransactionId_key" ON "Subscription"("appleOriginalTransactionId");
