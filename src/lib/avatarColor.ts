// Deterministic pastel badge color per name, so the same party/product
// always gets the same color across screens/sessions (hash of the name,
// not random) — mirrors the colored initial-avatar pattern used by
// reference billing apps for scannable list rows.
const PALETTE = [
 { bg: "#FDE8D7", text: "#B5651D" }, // tan
 { bg: "#DCEEE8", text: "#0368FE" }, // teal
 { bg: "#FBE1E6", text: "#B0345C" }, // pink
 { bg: "#E3E6FB", text: "#3B4CB0" }, // indigo
 { bg: "#FFF3C4", text: "#8A6D00" }, // amber
 { bg: "#E1F0FB", text: "#1E6FA6" }, // sky
 { bg: "#EAE1FB", text: "#6B3FA0" }, // violet
 { bg: "#E4F6DC", text: "#3E8E2F" }, // green
];

export function getAvatarColor(name: string): { bg: string; text: string } {
 let hash = 0;
 for (let i = 0; i < name.length; i++) {
 hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
 }
 return PALETTE[hash % PALETTE.length];
}

export function getInitial(name: string): string {
 return (name?.trim()?.[0] || "?").toUpperCase();
}
