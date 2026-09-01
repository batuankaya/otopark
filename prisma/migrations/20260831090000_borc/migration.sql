-- AlterEnum
ALTER TYPE "IslemTipi" ADD VALUE 'BORC_TAHSILATI';

-- AlterTable
ALTER TABLE "ParkKaydi" ADD COLUMN     "borcTutari" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "borcKalan" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tahsilEdilenBorc" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ParkKaydi_aracId_borcKalan_idx" ON "ParkKaydi"("aracId", "borcKalan");
