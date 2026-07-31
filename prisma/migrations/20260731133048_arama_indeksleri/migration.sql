-- Trigram eklentisi: "içinde geçen" (LIKE %x%) aramalarının indekslenebilmesi
-- için gerekli. Normal B-tree indeksi bu tür aramada kullanılamaz.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "Arac_metin_trgm_idx" ON "Arac" USING GIN ("marka" gin_trgm_ops, "model" gin_trgm_ops, "renk" gin_trgm_ops, "notlar" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ParkKaydi_aracId_idx" ON "ParkKaydi"("aracId");

-- CreateIndex
CREATE INDEX "ParkKaydi_plaka_trgm_idx" ON "ParkKaydi" USING GIN ("plaka" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ParkKaydi_metin_trgm_idx" ON "ParkKaydi" USING GIN ("marka" gin_trgm_ops, "model" gin_trgm_ops, "renk" gin_trgm_ops, "notlar" gin_trgm_ops);
