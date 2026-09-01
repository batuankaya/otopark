-- CreateEnum
CREATE TYPE "AracSinifi" AS ENUM ('BINEK', 'BUYUK');

-- DropIndex
DROP INDEX "Tarife_aktif_gecerlilikBaslangic_idx";

-- AlterTable
ALTER TABLE "Arac" ADD COLUMN     "aracSinifi" "AracSinifi" NOT NULL DEFAULT 'BINEK';

-- AlterTable
ALTER TABLE "ParkKaydi" ADD COLUMN     "aracSinifi" "AracSinifi" NOT NULL DEFAULT 'BINEK';

-- AlterTable
ALTER TABLE "Tarife" ADD COLUMN     "aracSinifi" "AracSinifi" NOT NULL DEFAULT 'BINEK';

-- CreateIndex
CREATE INDEX "Tarife_aracSinifi_aktif_gecerlilikBaslangic_idx" ON "Tarife"("aracSinifi", "aktif", "gecerlilikBaslangic");
