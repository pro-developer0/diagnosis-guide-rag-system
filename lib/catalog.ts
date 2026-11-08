// The fixed list of reference files in public/knowledge. Nothing can be added at runtime.

export type Disease = { slug: string; title: string; category: string };

export const CATALOG: Disease[] = [
  { slug: "hypertension", title: "Hypertension", category: "Cardiovascular" },
  { slug: "myocardial-infarction", title: "Acute Myocardial Infarction", category: "Cardiovascular" },
  { slug: "heart-failure", title: "Heart Failure", category: "Cardiovascular" },
  { slug: "type-2-diabetes", title: "Type 2 Diabetes Mellitus", category: "Endocrine" },
  { slug: "hypothyroidism", title: "Hypothyroidism", category: "Endocrine" },
  { slug: "asthma", title: "Asthma", category: "Respiratory" },
  { slug: "copd", title: "Chronic Obstructive Pulmonary Disease (COPD)", category: "Respiratory" },
  { slug: "pneumonia", title: "Community-Acquired Pneumonia", category: "Respiratory" },
  { slug: "tuberculosis", title: "Tuberculosis", category: "Infectious" },
  { slug: "malaria", title: "Malaria", category: "Infectious" },
  { slug: "dengue", title: "Dengue", category: "Infectious" },
  { slug: "typhoid-fever", title: "Typhoid Fever", category: "Infectious" },
  { slug: "hepatitis-b", title: "Hepatitis B", category: "Infectious" },
  { slug: "hiv-infection", title: "HIV Infection", category: "Infectious" },
  { slug: "chronic-kidney-disease", title: "Chronic Kidney Disease", category: "Renal and urinary" },
  { slug: "urinary-tract-infection", title: "Urinary Tract Infection", category: "Renal and urinary" },
  { slug: "ischemic-stroke", title: "Acute Ischemic Stroke", category: "Neurology and mental health" },
  { slug: "major-depressive-disorder", title: "Major Depressive Disorder", category: "Neurology and mental health" },
  { slug: "iron-deficiency-anemia", title: "Iron Deficiency Anemia", category: "Blood and joints" },
  { slug: "rheumatoid-arthritis", title: "Rheumatoid Arthritis", category: "Blood and joints" },
];
