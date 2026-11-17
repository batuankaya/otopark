import type { DefaultSession } from "next-auth";

/** Oturuma otopark rolünü ve ad-soyadını ekler. */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      rol: "ADMIN" | "GOREVLI";
      adSoyad: string;
      /** Oturumun açıldığı andaki `Kullanici.oturumSurumu`. */
      surum: number;
    } & DefaultSession["user"];
  }

  interface User {
    rol?: "ADMIN" | "GOREVLI";
    adSoyad?: string;
    oturumSurumu?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    rol?: "ADMIN" | "GOREVLI";
    adSoyad?: string;
    /** Oturumun açıldığı andaki `Kullanici.oturumSurumu`. */
    surum?: number;
  }
}
