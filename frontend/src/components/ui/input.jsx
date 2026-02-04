import * as React from 'react'; import { cn } from '@/lib/utils';
const Input = React.forwardRef(({ className, type, ...props }, ref) => (
<input type={type} className={cn('flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500', className)} ref={ref} {...props} />
)); Input.displayName = 'Input'; export { Input };
