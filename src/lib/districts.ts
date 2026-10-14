/** The 38 districts of Tamil Nadu. `code` is the 3-letter code used in batch pack numbers (HL-SLM-…). */
export interface District {
  code: string;
  slug: string;
  en: string;
  ta: string;
  /** Approximate road distance band from Mettur, used to suggest the earliest delivery date. */
  zone: 1 | 2 | 3;
}

export const DISTRICTS: District[] = [
  { code: "ARY", slug: "ariyalur", en: "Ariyalur", ta: "அரியலூர்", zone: 2 },
  { code: "CGL", slug: "chengalpattu", en: "Chengalpattu", ta: "செங்கல்பட்டு", zone: 3 },
  { code: "CHN", slug: "chennai", en: "Chennai", ta: "சென்னை", zone: 3 },
  { code: "CBE", slug: "coimbatore", en: "Coimbatore", ta: "கோயம்புத்தூர்", zone: 2 },
  { code: "CDL", slug: "cuddalore", en: "Cuddalore", ta: "கடலூர்", zone: 3 },
  { code: "DPI", slug: "dharmapuri", en: "Dharmapuri", ta: "தருமபுரி", zone: 1 },
  { code: "DGL", slug: "dindigul", en: "Dindigul", ta: "திண்டுக்கல்", zone: 2 },
  { code: "ERD", slug: "erode", en: "Erode", ta: "ஈரோடு", zone: 1 },
  { code: "KKI", slug: "kallakurichi", en: "Kallakurichi", ta: "கள்ளக்குறிச்சி", zone: 2 },
  { code: "KPM", slug: "kanchipuram", en: "Kanchipuram", ta: "காஞ்சிபுரம்", zone: 3 },
  { code: "KKM", slug: "kanniyakumari", en: "Kanniyakumari", ta: "கன்னியாகுமரி", zone: 3 },
  { code: "KRR", slug: "karur", en: "Karur", ta: "கரூர்", zone: 2 },
  { code: "KGI", slug: "krishnagiri", en: "Krishnagiri", ta: "கிருஷ்ணகிரி", zone: 1 },
  { code: "MDU", slug: "madurai", en: "Madurai", ta: "மதுரை", zone: 2 },
  { code: "MYD", slug: "mayiladuthurai", en: "Mayiladuthurai", ta: "மயிலாடுதுறை", zone: 3 },
  { code: "NGP", slug: "nagapattinam", en: "Nagapattinam", ta: "நாகப்பட்டினம்", zone: 3 },
  { code: "NMK", slug: "namakkal", en: "Namakkal", ta: "நாமக்கல்", zone: 1 },
  { code: "NLG", slug: "nilgiris", en: "Nilgiris", ta: "நீலகிரி", zone: 2 },
  { code: "PBL", slug: "perambalur", en: "Perambalur", ta: "பெரம்பலூர்", zone: 2 },
  { code: "PDK", slug: "pudukkottai", en: "Pudukkottai", ta: "புதுக்கோட்டை", zone: 2 },
  { code: "RMD", slug: "ramanathapuram", en: "Ramanathapuram", ta: "இராமநாதபுரம்", zone: 3 },
  { code: "RPT", slug: "ranipet", en: "Ranipet", ta: "இராணிப்பேட்டை", zone: 3 },
  { code: "SLM", slug: "salem", en: "Salem", ta: "சேலம்", zone: 1 },
  { code: "SVG", slug: "sivaganga", en: "Sivaganga", ta: "சிவகங்கை", zone: 3 },
  { code: "TKS", slug: "tenkasi", en: "Tenkasi", ta: "தென்காசி", zone: 3 },
  { code: "TNJ", slug: "thanjavur", en: "Thanjavur", ta: "தஞ்சாவூர்", zone: 2 },
  { code: "THN", slug: "theni", en: "Theni", ta: "தேனி", zone: 3 },
  { code: "TUT", slug: "thoothukudi", en: "Thoothukudi", ta: "தூத்துக்குடி", zone: 3 },
  { code: "TRY", slug: "tiruchirappalli", en: "Tiruchirappalli", ta: "திருச்சிராப்பள்ளி", zone: 2 },
  { code: "TVL", slug: "tirunelveli", en: "Tirunelveli", ta: "திருநெல்வேலி", zone: 3 },
  { code: "TPT", slug: "tirupathur", en: "Tirupathur", ta: "திருப்பத்தூர்", zone: 2 },
  { code: "TUP", slug: "tiruppur", en: "Tiruppur", ta: "திருப்பூர்", zone: 2 },
  { code: "TVR", slug: "tiruvallur", en: "Tiruvallur", ta: "திருவள்ளூர்", zone: 3 },
  { code: "TVM", slug: "tiruvannamalai", en: "Tiruvannamalai", ta: "திருவண்ணாமலை", zone: 2 },
  { code: "TVU", slug: "tiruvarur", en: "Tiruvarur", ta: "திருவாரூர்", zone: 3 },
  { code: "VLR", slug: "vellore", en: "Vellore", ta: "வேலூர்", zone: 2 },
  { code: "VPM", slug: "viluppuram", en: "Viluppuram", ta: "விழுப்புரம்", zone: 3 },
  { code: "VNR", slug: "virudhunagar", en: "Virudhunagar", ta: "விருதுநகர்", zone: 3 },
];

export const districtByCode = (code: string) => DISTRICTS.find((d) => d.code === code);
export const districtBySlug = (slug: string) => DISTRICTS.find((d) => d.slug === slug);
