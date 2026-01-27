import * as React from 'react';
import { cn } from '@/lib/utils';
export function Skeleton({ className, ...props }) { return <div className={cn('', className)} {...props} />; }
