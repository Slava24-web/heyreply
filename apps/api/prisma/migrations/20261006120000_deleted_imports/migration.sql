-- Vacancy ids of imported applications that were deleted and purged, so imports don't resurrect them
CREATE TABLE "DeletedImport" (
    "userId" TEXT NOT NULL,
    "externalSource" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedImport_pkey" PRIMARY KEY ("userId","externalSource","externalId")
);

ALTER TABLE "DeletedImport" ADD CONSTRAINT "DeletedImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
