-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CHECKOUT', 'RETURN', 'FINE_WAIVED', 'BOOK_ADDED', 'BOOK_EDITED', 'BOOK_DELETED', 'MEMBER_ADDED', 'MEMBER_EDITED', 'MEMBER_DEACTIVATED');

-- AlterTable
ALTER TABLE "Fine" ADD COLUMN     "waivedReason" TEXT;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
