import { useState, useCallback } from 'react';
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback(({ title, description, variant = 'default' }) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, title, description, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  return { toasts, toast, dismiss: (id) => setToasts((prev) => prev.filter((t) => t.id !== id)) };
}
