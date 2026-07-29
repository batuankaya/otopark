-- AlterTable
ALTER TABLE "Vardiya" ADD COLUMN     "kapatanId" TEXT;

-- AddForeignKey
ALTER TABLE "Vardiya" ADD CONSTRAINT "Vardiya_kapatanId_fkey" FOREIGN KEY ("kapatanId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Vardiya artık kullanıcı başına değil, OTOPARK GENELİNDE tek.
-- Bir görevli vardiyayı açtığında diğerleri ayrıca açmaz; hepsi aynı kasaya
-- işlem yapar. Bu yüzden kullanıcı başına tek açık vardiya kısıtı kaldırılıp
-- yerine "sistemde en fazla bir açık vardiya" kısıtı konur.
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS "vardiya_kullanici_acik_uq";

-- Eski modelde her görevlinin ayrı vardiyası olabildiği için birden fazla
-- açık vardiya kalmış olabilir. Yeni kısıt kurulabilsin diye en yenisi hariç
-- hepsi, gerçek tahsilatlarıyla birlikte kapatılır (kasa farkı 0 sayılır --
-- geçmişe dönük sayım yapılamaz).
UPDATE "Vardiya" v
SET "bitis" = NOW(),
    "toplamNakit" = COALESCE((
      SELECT SUM(p."tahsilEdilenUcret") FROM "ParkKaydi" p
      WHERE p."cikisVardiyaId" = v.id AND p."odemeYontemi" = 'NAKIT'), 0),
    "toplamKart" = COALESCE((
      SELECT SUM(p."tahsilEdilenUcret") FROM "ParkKaydi" p
      WHERE p."cikisVardiyaId" = v.id AND p."odemeYontemi" = 'KART'), 0),
    "kapanisKasa" = v."acilisKasa" + COALESCE((
      SELECT SUM(p."tahsilEdilenUcret") FROM "ParkKaydi" p
      WHERE p."cikisVardiyaId" = v.id AND p."odemeYontemi" = 'NAKIT'), 0),
    "fark" = 0,
    "notlar" = COALESCE(v."notlar" || ' | ', '')
               || 'Ortak vardiya modeline geçişte otomatik kapatıldı.'
WHERE v."bitis" IS NULL
  AND v."id" <> (
    SELECT id FROM "Vardiya" WHERE "bitis" IS NULL ORDER BY "baslangic" DESC LIMIT 1
  );

-- Sabit ifade üzerinde kısmi unique index: bitis'i NULL olan satırların
-- hepsi aynı anahtara (TRUE) düşer, dolayısıyla yalnızca biri var olabilir.
CREATE UNIQUE INDEX "vardiya_tek_acik_uq"
  ON "Vardiya" (("bitis" IS NULL))
  WHERE "bitis" IS NULL;
