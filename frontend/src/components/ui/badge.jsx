import * as React from 'react'; import { cn } from '@/lib/utils';
const badgeVariants = { default: 'bg-amber-100 text-amber-800', outline: 'border border-stone-200 text-stone-600', destructive: 'bg-red-100 text-red-800' };
function Badge({ className, variant = 'default', ...props }) { return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', badgeVariants[variant], className)} {...props} />; }
export { Badge, badgeVariants };
