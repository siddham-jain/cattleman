import * as React from 'react'; import { cn } from '@/lib/utils';
export function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;
  return (<div className='fixed inset-0 z-50 flex items-center justify-center'><div className='fixed inset-0 bg-black/50' onClick={() => onOpenChange(false)}/><div className='relative z-50 rounded-lg bg-white p-6 shadow-lg'>{children}</div></div>);
}
