import { useState, useCallback } from 'react';

/**
 * Hook pour gérer les modales de confirmation.
 * Remplace window.confirm() avec une modale React.
 *
 * Usage:
 *   const { confirm, modalProps } = useConfirm();
 *
 *   const handleDelete = async () => {
 *     const ok = await confirm({
 *       title: 'Supprimer ?',
 *       message: 'Cette action est irréversible.',
 *       variant: 'danger',
 *     });
 *     if (ok) await deleteItem();
 *   };
 *
 *   return <ConfirmModal {...modalProps} />;
 */

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger' | 'success' | 'info';
  showCancel?: boolean;
}

export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
    message: '',
  });
  const [resolveRef, setResolveRef] = useState<{ resolve: (value: boolean) => void } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);

    return new Promise<boolean>((resolve) => {
      setResolveRef({ resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolveRef?.resolve(true);
    setResolveRef(null);
  }, [resolveRef]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef?.resolve(false);
    setResolveRef(null);
  }, [resolveRef]);

  return {
    confirm,
    modalProps: {
      isOpen,
      ...options,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  };
}
