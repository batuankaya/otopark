"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatlaPara } from "@/lib/para";

const IZGARA_RENGI = "#e5e5e5";
const EKSEN_RENGI = "#525252";
const CUBUK_RENGI = "#1d4ed8";
const VURGU_RENGI = "#ea580c";

/** Grafiklerde ortak kullanılan ipucu kutusu. */
function Ipucu({
  active,
  payload,
  label,
  bicim,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string | number;
  bicim: (deger: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border-2 border-neutral-800 bg-white px-3 py-2 text-sm shadow-lg">
      <div className="font-semibold text-neutral-900">{label}</div>
      <div className="font-bold tabular-nums text-blue-800">{bicim(payload[0].value)}</div>
    </div>
  );
}

/** Gün gün ciro — son 7/30 gün raporunda gösterilir. */
export function CiroGrafigi({ veri }: { veri: Array<{ tarih: string; ciro: number }> }) {
  const gosterim = veri.map((gun) => ({
    ...gun,
    // 2026-07-27 -> 27.07
    etiket: `${gun.tarih.slice(8, 10)}.${gun.tarih.slice(5, 7)}`,
  }));

  return (
    <div className="mt-3 h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={gosterim} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
          <CartesianGrid stroke={IZGARA_RENGI} vertical={false} />
          <XAxis
            dataKey="etiket"
            tick={{ fill: EKSEN_RENGI, fontSize: 12 }}
            interval="preserveStartEnd"
            tickLine={false}
          />
          <YAxis
            tick={{ fill: EKSEN_RENGI, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={55}
            tickFormatter={(deger: number) => `${Math.round(deger)}₺`}
          />
          <Tooltip
            cursor={{ fill: "#f5f5f5" }}
            content={<Ipucu bicim={(deger) => formatlaPara(deger)} />}
          />
          <Bar dataKey="ciro" fill={CUBUK_RENGI} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Saatlik giriş yoğunluğu — en yoğun saat turuncu vurgulanır. */
export function DolulukGrafigi({ veri }: { veri: Array<{ saat: number; giris: number }> }) {
  const enYogun = Math.max(...veri.map((s) => s.giris), 0);
  const gosterim = veri.map((s) => ({
    ...s,
    etiket: `${String(s.saat).padStart(2, "0")}:00`,
  }));

  return (
    <div className="mt-3 h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={gosterim} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
          <CartesianGrid stroke={IZGARA_RENGI} vertical={false} />
          <XAxis
            dataKey="etiket"
            tick={{ fill: EKSEN_RENGI, fontSize: 11 }}
            interval={2}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: EKSEN_RENGI, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={40}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "#f5f5f5" }}
            content={<Ipucu bicim={(deger) => `${deger} araç girişi`} />}
          />
          <Bar dataKey="giris" radius={[4, 4, 0, 0]}>
            {gosterim.map((saat) => (
              <Cell
                key={saat.saat}
                fill={saat.giris === enYogun && enYogun > 0 ? VURGU_RENGI : CUBUK_RENGI}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
