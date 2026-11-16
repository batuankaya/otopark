import type { DefaultSession } from "next-auth";

/** Oturuma otopark rolünü ve ad-soyadını ekler. */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      rol: "ADMIN" | "GOREVLI";
      adSoyad: string;
      /** Oturumun açıldığı an (Unix milisaniye). */
      acilis?: number;
    } & DefaultSession["user"];
  }

  interface User {
    rol?: "ADMIN" | "GOREVLI";
    adSoyad?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    rol?: "ADMIN" | "GOREVLI";
    adSoyad?: string;
    /** Oturumun açıldığı an (Unix milisaniye) — şifre değişimi kontrolü için. */
    acilis?: number;
  }
}
