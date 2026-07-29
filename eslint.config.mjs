import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * Next.js 15 ile uyumlu ESLint yapılandırması.
 * (create-next-app Next 16 için üretmişti; 15'te dışa aktarım yolları farklı.)
 */
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**"],
  },
];

export default eslintConfig;
