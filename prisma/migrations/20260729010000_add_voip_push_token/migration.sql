-- iOS PushKit VoIP token, separate from the existing FCM token — lets
-- incoming calls be sent via direct APNs VoIP push so they reliably wake the
-- app and ring via CallKit even when fully backgrounded or killed.
ALTER TABLE "FcmDevice" ADD COLUMN "voipToken" TEXT;
CREATE UNIQUE INDEX "FcmDevice_voipToken_key" ON "FcmDevice"("voipToken");
