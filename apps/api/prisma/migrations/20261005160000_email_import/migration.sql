-- CreateTable
CREATE TABLE "InboundAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localPart" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "InboundAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageIdHash" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "platform" TEXT,
    "kind" TEXT NOT NULL,
    "outcome" TEXT,
    "confirmUrl" TEXT,
    "confirmCode" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundAddress_localPart_key" ON "InboundAddress"("localPart");

-- CreateIndex
CREATE INDEX "InboundAddress_userId_idx" ON "InboundAddress"("userId");

-- CreateIndex
CREATE INDEX "InboundEmail_userId_receivedAt_idx" ON "InboundEmail"("userId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmail_userId_messageIdHash_key" ON "InboundEmail"("userId", "messageIdHash");

-- AddForeignKey
ALTER TABLE "InboundAddress" ADD CONSTRAINT "InboundAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

