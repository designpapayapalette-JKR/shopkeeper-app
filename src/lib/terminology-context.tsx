import React, { createContext, useContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";

export type TerminologyLang = "en" | "hi";

interface TerminologyContextType {
  lang: TerminologyLang;
  setLang: (lang: TerminologyLang) => void;
  t: (key: keyof typeof MAPPINGS.en) => string;
}

const MAPPINGS = {
  en: {
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
  hi: {
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
  },
};

const TerminologyContext = createContext<TerminologyContextType | undefined>(undefined);

export function TerminologyProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<TerminologyLang>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const savedLang = await SecureStore.getItemAsync("term_lang");
        if (savedLang) setLangState(savedLang as TerminologyLang);
      } catch (e) {
        console.error("Failed to load local terminology storage:", e);
      } finally {
        setMounted(true);
      }
    }
    load();
  }, []);

  const setLang = async (l: TerminologyLang) => {
    setLangState(l);
    try {
      await SecureStore.setItemAsync("term_lang", l);
    } catch {}
  };

  const t = (key: keyof typeof MAPPINGS.en): string => {
    return MAPPINGS[lang][key];
  };

  return (
    <TerminologyContext.Provider value={{ lang, setLang, t }}>
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
