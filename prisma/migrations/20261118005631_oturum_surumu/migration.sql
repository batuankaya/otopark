-- AlterTable
ALTER TABLE "Kullanici" DROP COLUMN "sifreDegisimi",
ADD COLUMN     "oturumSurumu" INTEGER NOT NULL DEFAULT 0;

