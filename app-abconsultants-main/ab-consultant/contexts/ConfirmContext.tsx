import React, { createContext, useContext } from 'react';
import { useConfirm, ConfirmOptions } from '../hooks/useConfirm';
import ConfirmModal from '../components/ui/ConfirmModal';

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { confirm, modalProps } = useConfirm();
  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmModal {...modalProps} />
    </ConfirmContext.Provider>
  );
};

export const useConfirmDialog = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirmDialog must be used within ConfirmProvider');
  return ctx.confirm;
};
