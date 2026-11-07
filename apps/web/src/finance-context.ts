import type { Account, Category, Goal, Transaction, Workspace } from '@clara/shared';
import { createContext, useContext } from 'react';
import type { ModalType } from './FinanceForms';
export type FinanceContextType = {
  wid: string;
  workspace: Workspace;
  accounts: Account[];
  categories: Category[];
  from: string;
  to: string;
  month: string;
  open: (type: ModalType, t?: Transaction, g?: Goal) => void;
  refresh: () => Promise<void>;
};
export const FinanceContext = createContext<FinanceContextType | null>(null);
export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('Contexto financeiro ausente');
  return ctx;
}
