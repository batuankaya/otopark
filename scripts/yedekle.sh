#!/usr/bin/env bash
#
# Veritabanı yedeği alır.
#
# Kapsam bilerek küçük: günde bir dosya, son 7 gün saklanır. Uzun geçmiş
# arşivi hedeflenmiyor — amaç, gün içinde kazara veri kaybında (yanlış komut,
# disk hatası, konteyner silinmesi) o günün vardiya ve park kayıtlarını
# kurtarabilmek.
#
# Kullanım:
#   npm run yedek           → yedek al
#   npm run yedek:listele   → mevcut yedekleri gör
#
# Geri yükleme (DİKKAT: mevcut veriyi siler):
#   docker exec -i otopark-db psql -U otopark -d otopark_dev < yedekler/DOSYA.sql

set -euo pipefail

PROJE_KOKU="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
YEDEK_DIZINI="$PROJE_KOKU/yedekler"
KONTEYNER="otopark-db"
VERITABANI="otopark_dev"
KULLANICI="otopark"
SAKLAMA_GUN=7

mkdir -p "$YEDEK_DIZINI"

# Konteyner çalışıyor mu?
if ! docker ps --format '{{.Names}}' | grep -q "^${KONTEYNER}$"; then
  echo "✗ Veritabanı konteyneri çalışmıyor ($KONTEYNER)." >&2
  echo "  Başlatmak için: docker compose up -d" >&2
  exit 1
fi

DAMGA="$(date +%Y-%m-%d_%H%M)"
DOSYA="$YEDEK_DIZINI/otopark_${DAMGA}.sql"

# --clean --if-exists: geri yüklemede mevcut tablolar temizlenir, hata vermez.
# Şifre konteyner içinde zaten tanımlı olduğu için burada gerekmiyor.
if docker exec "$KONTEYNER" pg_dump \
  -U "$KULLANICI" -d "$VERITABANI" \
  --clean --if-exists --no-owner --no-privileges > "$DOSYA" 2>/dev/null; then

  BOYUT="$(du -h "$DOSYA" | cut -f1)"
  SATIR="$(wc -l < "$DOSYA" | tr -d ' ')"
  echo "✓ Yedek alındı: $(basename "$DOSYA") ($BOYUT, $SATIR satır)"
else
  rm -f "$DOSYA"
  echo "✗ Yedek alınamadı." >&2
  exit 1
fi

# Boş/bozuk yedek uyarısı: dosya oluştu diye içi dolu sanmayalım.
if ! grep -q "CREATE TABLE" "$DOSYA"; then
  echo "⚠ UYARI: Yedek dosyasında tablo tanımı yok — içerik boş olabilir." >&2
  exit 1
fi

# Eski yedekleri buda.
SILINEN=0
while IFS= read -r eski; do
  rm -f "$eski"
  SILINEN=$((SILINEN + 1))
done < <(find "$YEDEK_DIZINI" -name "otopark_*.sql" -type f -mtime +$SAKLAMA_GUN 2>/dev/null)

[ "$SILINEN" -gt 0 ] && echo "  $SILINEN eski yedek silindi ($SAKLAMA_GUN günden eski)."

TOPLAM="$(find "$YEDEK_DIZINI" -name "otopark_*.sql" -type f | wc -l | tr -d ' ')"
echo "  Toplam $TOPLAM yedek: $YEDEK_DIZINI"
