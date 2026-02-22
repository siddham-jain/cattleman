import * as React from 'react'; import { cn } from '@/lib/utils';
const Progress = React.forwardRef(({ className, value = 0, max = 100, ...props }, ref) => (
<div ref={ref} className={cn('relative h-3 w-full overflow-hidden rounded-full bg-stone-100', className)} {...props}>
<div className='h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 confidence-bar' style={{ width: `${Math.min(Math.max(value,0),max)}%` }}/></div>));
Progress.displayName = 'Progress'; export { Progress };
