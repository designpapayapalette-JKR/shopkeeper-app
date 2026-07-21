/**
 * Real CGST/SGST vs IGST split, based on comparing the company's registered
 * state against the billed party's state (standard Indian GST place-of-supply rule).
 * Falls back to intra-state (CGST+SGST) when either state is unknown, since a
 * single-shop retailer selling locally is the overwhelmingly common case.
 */
export function computeGstSplit(taxTotal: number, companyState?: string | null, partyState?: string | null) {
 const normalize = (s?: string | null) => (s ?? "").trim().toLowerCase();
 const isInterState =
 normalize(companyState) !== "" &&
 normalize(partyState) !== "" &&
 normalize(companyState) !== normalize(partyState);

 if (isInterState) {
 return { cgst: 0, sgst: 0, igst: taxTotal };
 }
 return { cgst: taxTotal / 2, sgst: taxTotal / 2, igst: 0 };
}
