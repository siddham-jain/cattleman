import * as React from 'react'; import { cn } from '@/lib/utils';
export function Toast({ title, description, variant = 'default' }) {
  return (<div className={cn('rounded-lg border p-4 shadow-lg bg-white min-w-[300px]', variant==='destructive' && 'border-red-500 bg-red-50')}>{title && <div className='font-semibold text-sm'>{title}</div>}{description && <div className='text-sm text-stone-500 mt-1'>{description}</div>}</div>);
}
