// Canonical list of India's 28 states + 8 union territories, per the GST
// state-code registry. Used anywhere a state needs to be a constrained
// value rather than free text — critically, `party.state` and
// `company.state` are compared by exact string match in
// `computeGstSplit()` (shopkeeper-api/src/utils/gst.ts) to decide
// CGST/SGST vs IGST, so any spelling drift between the two silently
// produces the wrong tax split. Mirrors shopkeeper-web/src/lib/indianStates.ts
// — keep both in sync.
export const INDIAN_STATES: string[] = [
 "Andhra Pradesh",
 "Arunachal Pradesh",
 "Assam",
 "Bihar",
 "Chhattisgarh",
 "Goa",
 "Gujarat",
 "Haryana",
 "Himachal Pradesh",
 "Jharkhand",
 "Karnataka",
 "Kerala",
 "Madhya Pradesh",
 "Maharashtra",
 "Manipur",
 "Meghalaya",
 "Mizoram",
 "Nagaland",
 "Odisha",
 "Punjab",
 "Rajasthan",
 "Sikkim",
 "Tamil Nadu",
 "Telangana",
 "Tripura",
 "Uttar Pradesh",
 "Uttarakhand",
 "West Bengal",
 "Andaman and Nicobar Islands",
 "Chandigarh",
 "Dadra and Nagar Haveli and Daman and Diu",
 "Delhi",
 "Jammu and Kashmir",
 "Ladakh",
 "Lakshadweep",
 "Puducherry",
];
