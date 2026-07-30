-- CreateTable
CREATE TABLE "PersonelGiris" (
    "id" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "gelisZamani" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gun" TIMESTAMP(3) NOT NULL,
    "duzeltenId" TEXT,
    "duzeltilenEski" TIMESTAMP(3),
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonelGiris_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonelGiris_gun_idx" ON "PersonelGiris"("gun");

-- CreateIndex
CREATE UNIQUE INDEX "PersonelGiris_kullaniciId_gun_key" ON "PersonelGiris"("kullaniciId", "gun");

-- AddForeignKey
ALTER TABLE "PersonelGiris" ADD CONSTRAINT "PersonelGiris_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
