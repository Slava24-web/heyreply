-- Proof of consent to the terms and personal data processing (null for accounts created before consent was collected)
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "termsVersion" TEXT,
ADD COLUMN "termsAcceptedIp" TEXT;
