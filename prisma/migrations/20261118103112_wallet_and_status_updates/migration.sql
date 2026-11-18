/*
  Warnings:

  - The `referenceType` column on the `WalletTransaction` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[walletId,idempotencyKey]` on the table `WalletTransaction` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "WalletTransactionReferenceType" AS ENUM ('PROJECT');

-- AlterEnum
ALTER TYPE "ProjectStatus" ADD VALUE 'CANCELLED';

-- DropIndex
DROP INDEX "WalletTransaction_idempotencyKey_key";

-- AlterTable
ALTER TABLE "WalletTransaction" DROP COLUMN "referenceType",
ADD COLUMN     "referenceType" "WalletTransactionReferenceType";

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_walletId_idempotencyKey_key" ON "WalletTransaction"("walletId", "idempotencyKey");
