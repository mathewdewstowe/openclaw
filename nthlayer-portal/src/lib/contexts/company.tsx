"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface CompanyInfo {
  id: string;
  name: string;
  url: string | null;
  sector: string | null;
  role: string; // owner | editor | viewer
}

interface CompanyContextValue {
  activeCompany: CompanyInfo | null;
  companies: CompanyInfo[];
  setActiveCompany: (company: CompanyInfo) => void;
}

const CompanyContext = createContext<CompanyContextValue>({
  activeCompany: null,
  companies: [],
  setActiveCompany: () => {},
});

export function CompanyProvider({
  initialCompanies,
  children,
}: {
  initialCompanies: CompanyInfo[];
  children: React.ReactNode;
}) {
  const [activeCompany, setActive] = useState<CompanyInfo | null>(
    initialCompanies[0] ?? null
  );

  const setActiveCompany = useCallback((company: CompanyInfo) => {
    setActive(company);
  }, []);

  return (
    <CompanyContext.Provider
      value={{ activeCompany, companies: initialCompanies, setActiveCompany }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
