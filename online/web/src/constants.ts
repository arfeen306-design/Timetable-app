/** Shared constants for the Timetable web app — mirrors desktop utils/helpers.py */

export const SUBJECT_CATEGORIES = ["Core", "Elective", "Activity", "Language"] as const;

export const ROOM_TYPES = ["Classroom", "Laboratory", "Computer Lab", "Library", "Sports Hall", "Art Room", "Music Room", "Hall"] as const;

export const TITLE_OPTIONS = ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof.", "Sir", "Madam"] as const;

/** Curated colour palette for subjects */
export const SUBJECT_COLORS = [
  "#4A90D9", "#50C878", "#E8725A", "#F5A623", "#9B59B6",
  "#1ABC9C", "#E74C3C", "#3498DB", "#2ECC71", "#F39C12",
  "#8E44AD", "#16A085", "#D35400", "#2980B9", "#27AE60",
  "#C0392B", "#7F8C8D", "#E67E22", "#1F618D", "#117A65",
] as const;

/** Default subjects available in the "Import from Library" dialog */
export const DEFAULT_SUBJECTS: { name: string; code: string; category: string; color: string }[] = [
  { name: "Mathematics (Syllabus D)", code: "MAT-D", category: "Core",     color: "#E74C3C" },
  { name: "Additional Mathematics",   code: "AMAT", category: "Core",     color: "#8E44AD" },
  { name: "Physics",                 code: "PHY",  category: "Core",     color: "#3498DB" },
  { name: "Chemistry",               code: "CHM",  category: "Core",     color: "#2ECC71" },
  { name: "Biology",                 code: "BIO",  category: "Core",     color: "#50C878" },
  { name: "English Language",        code: "ENG",  category: "Core",     color: "#E67E22" },
  { name: "Urdu (First Language)",   code: "URD1", category: "Core",     color: "#E8725A" },
  { name: "Urdu (Second Language)",  code: "URD2", category: "Core",     color: "#D35400" },
  { name: "Islamiat",               code: "ISL",  category: "Core",     color: "#F5A623" },
  { name: "Pakistan Studies",       code: "PST",  category: "Core",     color: "#1ABC9C" },
  { name: "Computer Science",       code: "CS",   category: "Core",     color: "#4A90D9" },
  { name: "Economics",              code: "ECO",  category: "Elective", color: "#16A085" },
  { name: "Accounting",             code: "ACC",  category: "Elective", color: "#2980B9" },
  { name: "Business Studies",       code: "BUS",  category: "Elective", color: "#C0392B" },
  { name: "Sociology",             code: "SOC",  category: "Elective", color: "#7F8C8D" },
  { name: "Psychology",            code: "PSY",  category: "Elective", color: "#9B59B6" },
  { name: "Law",                   code: "LAW",  category: "Elective", color: "#1F618D" },
  { name: "History",               code: "HIS",  category: "Core",     color: "#34495E" },
  { name: "Geography",             code: "GEO",  category: "Core",     color: "#117A65" },
  { name: "General Science",       code: "GSC",  category: "Core",     color: "#27AE60" },
  { name: "Social Studies",        code: "SST",  category: "Core",     color: "#F39C12" },
  { name: "Physical Education",    code: "PE",   category: "Activity", color: "#2C3E50" },
  { name: "Arts",                  code: "ART",  category: "Activity", color: "#E91E63" },
  { name: "Home Economics",        code: "HEC",  category: "Elective", color: "#FF9800" },
  { name: "Commerce",             code: "COM",  category: "Elective", color: "#795548" },
];
