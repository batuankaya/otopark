/**
 * Araç marka/model kataloğu.
 *
 * Hem araç girişi formundaki seçicide hem de seed verisinde kullanılır —
 * liste iki yerde ayrışmasın diye tek kaynak burasıdır.
 *
 * Türkiye'de sahada karşılaşılan eski modeller bilerek kapsandı: otoparka
 * gelen araçların önemli bir kısmı 90'lar–2000'ler modeli ve görevlinin
 * bunları listede bulamayıp elle yazması zaman kaybettiriyor.
 *
 * Listede olmayan araç için serbest metin girişi her zaman açıktır.
 */

export type Marka = {
  ad: string;
  modeller: readonly string[];
};

export const MARKALAR: readonly Marka[] = [
  {
    ad: "Tofaş",
    modeller: ["Şahin", "Kartal", "Doğan", "Doğan SLX", "Serçe", "Murat 124", "Murat 131"],
  },
  {
    ad: "Renault",
    modeller: [
      "Toros",
      "R12",
      "R9",
      "R19",
      "R21",
      "Broadway",
      "Clio",
      "Symbol",
      "Megane",
      "Fluence",
      "Taliant",
      "Kangoo",
      "Captur",
      "Kadjar",
    ],
  },
  {
    ad: "Fiat",
    modeller: [
      "Uno",
      "Tempra",
      "Tipo",
      "Marea",
      "Palio",
      "Albea",
      "Siena",
      "Linea",
      "Punto",
      "Egea",
      "Doblo",
      "Fiorino",
      "Ducato",
    ],
  },
  {
    ad: "Volkswagen",
    modeller: [
      "Golf",
      "Polo",
      "Passat",
      "Jetta",
      "Bora",
      "Caddy",
      "Transporter",
      "Tiguan",
      "T-Roc",
      "Amarok",
    ],
  },
  {
    ad: "Ford",
    modeller: [
      "Escort",
      "Taunus",
      "Sierra",
      "Fiesta",
      "Focus",
      "Mondeo",
      "Transit",
      "Tourneo",
      "Connect",
      "Ranger",
      "Kuga",
      "Puma",
    ],
  },
  {
    ad: "Opel",
    modeller: [
      "Kadett",
      "Vectra",
      "Astra",
      "Corsa",
      "Omega",
      "Zafira",
      "Insignia",
      "Mokka",
      "Combo",
    ],
  },
  {
    ad: "Toyota",
    modeller: ["Corolla", "Yaris", "Auris", "Avensis", "C-HR", "RAV4", "Hilux", "Camry"],
  },
  {
    ad: "Honda",
    modeller: ["Civic", "Accord", "City", "Jazz", "CR-V", "HR-V"],
  },
  {
    ad: "Hyundai",
    modeller: ["Accent", "Accent Era", "Accent Blue", "Getz", "i10", "i20", "i30", "Elantra", "Tucson", "Bayon"],
  },
  {
    ad: "Peugeot",
    modeller: ["205", "306", "307", "308", "406", "407", "Partner", "Bipper", "Boxer", "2008", "3008"],
  },
  {
    ad: "Citroën",
    modeller: ["AX", "Xsara", "C3", "C4", "C5", "Berlingo", "Nemo", "Jumper"],
  },
  {
    ad: "Mercedes-Benz",
    modeller: ["190", "C Serisi", "E Serisi", "S Serisi", "A Serisi", "Vito", "Sprinter", "Vaneo", "GLA", "GLC"],
  },
  {
    ad: "BMW",
    modeller: ["3 Serisi", "5 Serisi", "1 Serisi", "7 Serisi", "X1", "X3", "X5"],
  },
  {
    ad: "Audi",
    modeller: ["A3", "A4", "A6", "A1", "Q2", "Q3", "Q5"],
  },
  {
    ad: "Dacia",
    modeller: ["Logan", "Sandero", "Duster", "Dokker", "Lodgy", "Jogger"],
  },
  {
    ad: "Skoda",
    modeller: ["Fabia", "Octavia", "Superb", "Rapid", "Kamiq", "Karoq", "Kodiaq"],
  },
  {
    ad: "Seat",
    modeller: ["Ibiza", "Cordoba", "Leon", "Toledo", "Arona", "Ateca"],
  },
  {
    ad: "Nissan",
    modeller: ["Micra", "Almera", "Primera", "Qashqai", "Juke", "X-Trail"],
  },
  {
    ad: "Mazda",
    modeller: ["323", "626", "2", "3", "6", "CX-3", "CX-5"],
  },
  {
    ad: "Kia",
    modeller: ["Rio", "Cerato", "Ceed", "Sportage", "Picanto", "Stonic"],
  },
  {
    ad: "Chevrolet",
    modeller: ["Aveo", "Kalos", "Lacetti", "Cruze", "Captiva"],
  },
  {
    ad: "Volvo",
    modeller: ["S40", "S60", "S80", "V40", "XC40", "XC60"],
  },
  {
    ad: "Anadol",
    modeller: ["A1", "A2", "SV-1600", "Böcek", "Pikap"],
  },
  {
    ad: "Lada",
    modeller: ["Samara", "Niva", "Vega", "Kalina"],
  },
  {
    ad: "Isuzu",
    modeller: ["NPR", "D-Max", "Midi"],
  },
  {
    ad: "Iveco",
    modeller: ["Daily", "Eurocargo"],
  },
  {
    ad: "Togg",
    modeller: ["T10X", "T10F"],
  },
  {
    ad: "Diğer",
    modeller: [],
  },
];

/** Katalogdaki tüm marka adları (seçici için). */
export const MARKA_ADLARI: readonly string[] = MARKALAR.map((m) => m.ad);

/** Bir markanın modelleri; marka bulunamazsa boş dizi. */
export function markaModelleri(marka: string): readonly string[] {
  return MARKALAR.find((m) => m.ad.toLowerCase() === marka.trim().toLowerCase())?.modeller ?? [];
}

/** Katalogda gerçekten model tanımlı mı? ("Diğer" gibi boş markalar için false) */
export function markaModelliMi(marka: string): boolean {
  return markaModelleri(marka).length > 0;
}
