import { useEffect, useState } from 'react';

export function useLocal<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      const saved = JSON.parse(raw);
      if (Array.isArray(initial)) return (Array.isArray(saved) ? saved : initial) as T;
      if (initial && typeof initial === 'object') return { ...initial, ...(saved && typeof saved === 'object' ? saved : {}) } as T;
      return saved as T;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be unavailable */ }
  }, [key, value]);
  return [value, setValue] as const;
}
