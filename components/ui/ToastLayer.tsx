import React from 'react';
import { useApp } from '@/hooks/useApp';
import { Toast } from './Toast';

export function ToastLayer() {
  const { toast } = useApp();
  return <Toast message={toast?.message ?? ''} type={toast?.type ?? 'success'} visible={!!toast} />;
}
