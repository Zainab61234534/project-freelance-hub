/*
  Warnings:

  - You are about to drop the column `isApproved` on the `Delivery` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'APPROVED', 'REVISION_REQUESTED');

-- AlterTable
ALTER TABLE "Delivery" DROP COLUMN "isApproved",
ADD COLUMN     "reviewMessage" TEXT,
ADD COLUMN     "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");
