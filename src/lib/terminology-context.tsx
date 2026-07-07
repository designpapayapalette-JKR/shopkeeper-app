import React, { createContext, useContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";

export type TerminologyMode = "modern" | "traditional";
export type TerminologyLang = "en" | "hi";

interface TerminologyContextType {
  mode: TerminologyMode;
  lang: TerminologyLang;
  setMode: (mode: TerminologyMode) => void;
  setLang: (lang: TerminologyLang) => void;
  t: (key: keyof typeof MAPPINGS.modern) => string;
}

const MAPPINGS = {
  modern: {
    receivables: "Receivables",
    payables: "Payables",
    netPosition: "Net Position",
    credit: "Credit",
    debit: "Debit",
    sales: "Sales Invoice",
    purchases: "Purchases",
    estimate: "Estimate",
    gstBill: "GST Invoice",
    inventory: "Inventory",
    sku: "SKU",
    reorderLevel: "Reorder Level",
    challans: "Delivery Challans",
    transit: "In Transit",
    delivered: "Delivered",
    attendance: "Attendance",
    staff: "Staff List",
    payroll: "Payroll",
    // navigation items
    dashboard: "Dashboard",
    history: "History",
    bankAccounts: "Bank Accounts",
    tracking: "Field Tracking",
    expenses: "Expenses",
    reports: "Reports",
    scannedDocs: "Scanned Docs",
    activityLog: "Activity Log",
    recycleBin: "Recycle Bin",
    dayBook: "Day Book",
  },
  traditional_en: {
    receivables: "Paise Lena (Receivable)",
    payables: "Paise Dena (Payable)",
    netPosition: "Galla Balances",
    credit: "Paise Mile (Jama)",
    debit: "Paise Diye (Naam)",
    sales: "Bikri (Sales)",
    purchases: "Kharidi (Purchases)",
    estimate: "Kaccha Bill (Estimate)",
    gstBill: "Pacca Bill (GST)",
    inventory: "Maal Ka Stock",
    sku: "Item Code",
    reorderLevel: "Stock Alert Level",
    challans: "Challan / Bilti",
    transit: "Maal Rawana (Transit)",
    delivered: "Maal Pahuncha (Arrived)",
    attendance: "Haziri Register",
    staff: "Kaamgar / Staff",
    payroll: "Pagar / Salary",
    // navigation items
    dashboard: "Dashboard",
    history: "History",
    bankAccounts: "Bank Accounts",
    tracking: "Field Tracking",
    expenses: "Expenses",
    reports: "Reports",
    scannedDocs: "Scanned Docs",
    activityLog: "Activity Log",
    recycleBin: "Recycle Bin",
    dayBook: "Day Book (Roznamcha)",
  },
  traditional_hi: {
    receivables: "पैसे लेने हैं (उधार)",
    payables: "पैसे देने हैं (बाकी)",
    netPosition: "नेट गल्ला बैलेंस",
    credit: "पैसे मिले (जमा)",
    debit: "पैसे दिए (नाम)",
    sales: "बिक्री (बिल)",
    purchases: "खरीद (माल आया)",
    estimate: "कच्चा बिल (एस्टीमेट)",
    gstBill: "पक्का बिल (जीएसटी)",
    inventory: "माल का स्टॉक",
    sku: "आइटम कोड",
    reorderLevel: "स्टॉक कम का अलर्ट",
    challans: "चालान / बिल्टी",
    transit: "माल रवाना हुआ",
    delivered: "माल पहुँच गया",
    attendance: "हाजिरी रजिस्टर",
    staff: "कामगार (कर्मचारी)",
    payroll: "तनख्वाह / पगार",
    // navigation items
    dashboard: "डैशबोर्ड",
    history: "इतिहास",
    bankAccounts: "बैंक खाते",
    tracking: "फील्ड ट्रैकिंग",
    expenses: "खर्चे (Expenses)",
    reports: "रिपोर्ट्स",
    scannedDocs: "स्कैन दस्तावेज",
    activityLog: "गतिविधि लॉग",
    recycleBin: "रीसायकल बिन",
    dayBook: "रोजनामचा (Day Book)",
  }
};

const TerminologyContext = createContext<TerminologyContextType | undefined>(undefined);

export function TerminologyProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<TerminologyMode>("modern");
  const [lang, setLangState] = useState<TerminologyLang>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const savedMode = await SecureStore.getItemAsync("term_mode");
        const savedLang = await SecureStore.getItemAsync("term_lang");
        if (savedMode) setModeState(savedMode as TerminologyMode);
        if (savedLang) setLangState(savedLang as TerminologyLang);
      } catch (e) {
        console.error("Failed to load local terminology storage:", e);
      } finally {
        setMounted(true);
      }
    }
    load();
  }, []);

  const setMode = async (m: TerminologyMode) => {
    setModeState(m);
    try {
      await SecureStore.setItemAsync("term_mode", m);
    } catch {}
  };

  const setLang = async (l: TerminologyLang) => {
    setLangState(l);
    try {
      await SecureStore.setItemAsync("term_lang", l);
    } catch {}
  };

  const t = (key: keyof typeof MAPPINGS.modern): string => {
    if (mode === "modern") {
      return MAPPINGS.modern[key];
    }
    if (lang === "hi") {
      return MAPPINGS.traditional_hi[key];
    }
    return MAPPINGS.traditional_en[key];
  };

  return (
    <TerminologyContext.Provider value={{ mode, lang, setMode, setLang, t }}>
      {children}
    </TerminologyContext.Provider>
  );
}

export function useTerminology() {
  const context = useContext(TerminologyContext);
  if (!context) {
    throw new Error("useTerminology must be used within a TerminologyProvider");
  }
  return context;
}
