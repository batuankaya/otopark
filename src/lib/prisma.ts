import { PrismaClient } from "@prisma/client";

/**
 * Geliştirme sırasında Next.js hot-reload her derlemede modülleri yeniden
 * yükler; her seferinde yeni PrismaClient açmak bağlantı havuzunu tüketir.
 * Bu yüzden istemci global nesnede saklanır.
 */
const globalNesne = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalNesne.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalNesne.prisma = prisma;
}
