-- AlterTable
ALTER TABLE "Arac" ADD COLUMN     "plakaGosterim" TEXT,
ADD COLUMN     "ulkeKodu" TEXT,
ADD COLUMN     "yabanciPlaka" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ParkKaydi" ADD COLUMN     "plakaGosterim" TEXT,
ADD COLUMN     "ulkeKodu" TEXT,
ADD COLUMN     "yabanciPlaka" BOOLEAN NOT NULL DEFAULT false;
