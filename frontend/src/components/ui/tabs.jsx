import * as React from 'react'; import { cn } from '@/lib/utils';
const Tabs = ({ defaultValue, children }) => { const [active, setActive] = React.useState(defaultValue);
  return <div>{React.Children.map(children, child => React.cloneElement(child, { active, setActive }))}</div>; };
const TabsList = ({ children, active, setActive }) => (<div className='flex gap-1 rounded-lg bg-stone-100 p-1'>{React.Children.map(children, child => React.cloneElement(child, { active, setActive }))}</div>);
const TabsTrigger = ({ value, children, active, setActive }) => (<button className={cn('rounded-md px-3 py-1.5 text-sm', active===value?'bg-white shadow-sm':'text-stone-500')} onClick={() => setActive(value)}>{children}</button>);
const TabsContent = ({ value, children, active }) => active===value ? <div className='mt-4'>{children}</div> : null;
export { Tabs, TabsList, TabsTrigger, TabsContent };
