import { describe, expect, it } from "vitest";

import { csvAlani, csvSatiri } from "@/lib/csv";

describe("csvAlani", () => {
  it("formül olarak çalışabilecek metni etkisizleştirir", () => {
    expect(csvAlani('=HYPERLINK("http://x","tikla")')).toBe(`"'=HYPERLINK(""http://x"",""tikla"")"`);
    expect(csvAlani("+90 555")).toBe("'+90 555");
    expect(csvAlani("-cmd")).toBe("'-cmd");
    expect(csvAlani("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvAlani("\t=1+1")).toBe("'\t=1+1");
  });

  it("negatif sayıya ve sıradan metne dokunmaz", () => {
    expect(csvAlani("-12,50")).toBe("-12,50");
    expect(csvAlani("-5")).toBe("-5");
    expect(csvAlani("Müşteri 2=1 dedi")).toBe("Müşteri 2=1 dedi");
    expect(csvAlani(150)).toBe("150");
    expect(csvAlani(null)).toBe("");
  });

  it("ayıraç, tırnak ve satır sonu içeren alanı tırnaklar", () => {
    expect(csvAlani("a;b")).toBe('"a;b"');
    expect(csvAlani("a\nb")).toBe('"a\nb"');
    expect(csvSatiri(["x", "=1", 2])).toBe("x;'=1;2");
  });
});
