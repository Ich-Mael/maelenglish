/**
 * Francophone African countries (French is an official language), used for the E-Kalan student
 * account form. Stored as ISO 3166-1 alpha-2 codes; labels in French.
 */
const FRANCOPHONE_AFRICA = [
  { code: "BJ", name: "Bénin" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" },
  { code: "CM", name: "Cameroun" },
  { code: "CF", name: "Centrafrique" },
  { code: "KM", name: "Comores" },
  { code: "CG", name: "Congo" },
  { code: "CD", name: "Congo (RDC)" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "DJ", name: "Djibouti" },
  { code: "GA", name: "Gabon" },
  { code: "GN", name: "Guinée" },
  { code: "GQ", name: "Guinée équatoriale" },
  { code: "MG", name: "Madagascar" },
  { code: "ML", name: "Mali" },
  { code: "NE", name: "Niger" },
  { code: "RW", name: "Rwanda" },
  { code: "SN", name: "Sénégal" },
  { code: "SC", name: "Seychelles" },
  { code: "TD", name: "Tchad" },
  { code: "TG", name: "Togo" },
];

const COUNTRY_CODES = FRANCOPHONE_AFRICA.map((c) => c.code);

function countryName(code) {
  const c = FRANCOPHONE_AFRICA.find((x) => x.code === code);
  return c ? c.name : "";
}

module.exports = { FRANCOPHONE_AFRICA, COUNTRY_CODES, countryName };
