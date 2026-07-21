function hashCode(s: string): number {
 let hash = 0;
 for (let i = 0; i < s.length; i++) {
 const char = s.charCodeAt(i);
 hash = ((hash << 5) - hash) + char;
 hash |= 0;
 }
 return hash;
}

export function generateEan13(prefix: string, index: number): string {
 const seed = Math.abs(hashCode(`${prefix}-${index}-${Date.now()}`));
 const digits = (seed % 1_000_000_000_000).toString().padStart(12, "0");
 return digits + ean13CheckDigit(digits);
}

function ean13CheckDigit(code: string): string {
 let sum = 0;
 for (let i = 0; i < code.length; i++) {
 sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
 }
 return String((10 - (sum % 10)) % 10);
}

const L_CODES: Record<string, string> = {
 "0": "0001101", "1": "0011001", "2": "0010011", "3": "0111101",
 "4": "0100011", "5": "0110001", "6": "0101111", "7": "0111011",
 "8": "0110111", "9": "0001011",
};
const R_CODES: Record<string, string> = {
 "0": "1110010", "1": "1100110", "2": "1101100", "3": "1000010",
 "4": "1011100", "5": "1001110", "6": "1010000", "7": "1000100",
 "8": "1001000", "9": "1110100",
};
const G_CODES: Record<string, string> = {
 "0": "0100111", "1": "0110011", "2": "0011011", "3": "0100001",
 "4": "0011101", "5": "0111001", "6": "0000101", "7": "0010001",
 "8": "0001001", "9": "0010111",
};

const PARITY_PATTERNS: Record<string, string[]> = {
 "0": ["L","L","L","L","L","L"],
 "1": ["L","L","G","L","G","G"],
 "2": ["L","L","G","G","L","G"],
 "3": ["L","L","G","G","G","L"],
 "4": ["L","G","L","L","G","G"],
 "5": ["L","G","G","L","L","G"],
 "6": ["L","G","G","G","L","L"],
 "7": ["L","G","L","G","L","G"],
 "8": ["L","G","L","G","G","L"],
 "9": ["L","G","G","L","G","L"],
};

export function ean13Bars(barcode: string): number[] {
 const d = barcode.replace(/\D/g, "").slice(0, 13).padStart(13, "0");
 const parity = PARITY_PATTERNS[d[0]];
 let pattern = "101";
 for (let i = 1; i <= 6; i++) {
 const enc = parity[i - 1] === "L" ? L_CODES[d[i]] : G_CODES[d[i]];
 pattern += enc;
 }
 pattern += "01010";
 for (let i = 7; i <= 12; i++) {
 pattern += R_CODES[d[i]];
 }
 pattern += "101";
 return pattern.split("").map(Number);
}
