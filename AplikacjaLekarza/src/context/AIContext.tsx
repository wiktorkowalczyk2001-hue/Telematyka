import React, { createContext, useContext, useState, useCallback } from 'react';

export type AIContextData = {
  screen?: string;
  screenLabel?: string;
  patient?: {
    name: string;
    age?: number;
    diagnosis?: string;
    medications?: string;
    allergies?: string;
  };
  selectedDate?: string;
  visitsToday?: number;
  totalPatients?: number;
};

type AIContextType = {
  aiContext: AIContextData;
  setAIContext: (data: AIContextData) => void;
  clearAIContext: () => void;
};

const AIContext = createContext<AIContextType>({
  aiContext: {},
  setAIContext: () => {},
  clearAIContext: () => {},
});

export function AIContextProvider({ children }: { children: React.ReactNode }) {
  const [aiContext, setAIContextState] = useState<AIContextData>({});

  const setAIContext = useCallback((data: AIContextData) => {
    setAIContextState(data);
  }, []);

  const clearAIContext = useCallback(() => {
    setAIContextState({});
  }, []);

  return (
    <AIContext.Provider value={{ aiContext, setAIContext, clearAIContext }}>
      {children}
    </AIContext.Provider>
  );
}

export function useAIContext() {
  return useContext(AIContext);
}

export function buildContextPrompt(ctx: AIContextData): string {
  if (!ctx || Object.keys(ctx).length === 0) return '';

  const parts: string[] = [`[KONTEKST EKRANU: ${ctx.screenLabel || ctx.screen || 'nieznany'}]`];

  if (ctx.totalPatients != null) {
    parts.push(`Łączna liczba pacjentów w systemie: ${ctx.totalPatients}`);
  }
  if (ctx.patient) {
    parts.push(`Aktualnie oglądany pacjent: ${ctx.patient.name}${ctx.patient.age ? `, ${ctx.patient.age} lat` : ''}${ctx.patient.diagnosis ? `, diagnoza: ${ctx.patient.diagnosis}` : ''}${ctx.patient.medications ? `, leki: ${ctx.patient.medications}` : ''}${ctx.patient.allergies ? `, alergie: ${ctx.patient.allergies}` : ''}`);
  }
  if (ctx.selectedDate) {
    parts.push(`Wybrany dzień w kalendarzu: ${ctx.selectedDate}${ctx.visitsToday != null ? `, wizyt: ${ctx.visitsToday}` : ''}`);
  }

  return parts.join('\n');
}
