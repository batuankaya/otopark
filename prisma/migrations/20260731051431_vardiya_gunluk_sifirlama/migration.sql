-- AlterTable
ALTER TABLE "Ayar" ADD COLUMN     "vardiyaSifirlamaSaati" INTEGER NOT NULL DEFAULT 12;

-- AlterTable
ALTER TABLE "Vardiya" ADD COLUMN     "otomatikKapanis" BOOLEAN NOT NULL DEFAULT false;
