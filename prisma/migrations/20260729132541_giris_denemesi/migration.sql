-- CreateTable
CREATE TABLE "GirisDenemesi" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "zaman" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GirisDenemesi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GirisDenemesi_email_zaman_idx" ON "GirisDenemesi"("email", "zaman");

-- CreateIndex
CREATE INDEX "GirisDenemesi_ip_zaman_idx" ON "GirisDenemesi"("ip", "zaman");

-- CreateIndex
CREATE INDEX "GirisDenemesi_zaman_idx" ON "GirisDenemesi"("zaman");
