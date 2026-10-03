import * as RToast from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'info' | 'success' | 'error';
interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
}
type Notify = (t: { title: string; description?: string; tone?: Tone }) => void;

const ToastContext = createContext<Notify | null>(null);

export function useToast(): Notify {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const TONE_BORDER: Record<Tone, string> = {
  info: 'border-border',
  success: 'border-success',
  error: 'border-danger',
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const notify = useCallback<Notify>(({ tone = 'info', ...t }) => {
    setItems((prev) => [...prev, { id: nextId++, tone, ...t }]);
  }, []);
  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      <RToast.Provider swipeDirection="right" duration={5000}>
        {children}
        {items.map((t) => (
          <RToast.Root
            key={t.id}
            onOpenChange={(open) => {
              if (!open) setItems((prev) => prev.filter((x) => x.id !== t.id));
            }}
            className={cn(
              'flex items-start gap-3 rounded-card border bg-raised p-3 text-sm text-fg',
              TONE_BORDER[t.tone],
            )}
          >
            <div className="flex-1">
              <RToast.Title className="font-medium">{t.title}</RToast.Title>
              {t.description ? (
                <RToast.Description className="mt-0.5 text-fg-secondary">
                  {t.description}
                </RToast.Description>
              ) : null}
            </div>
            <RToast.Close aria-label="Dismiss" className="text-fg-secondary hover:text-fg">
              <X size={14} aria-hidden="true" />
            </RToast.Close>
          </RToast.Root>
        ))}
        <RToast.Viewport className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" />
      </RToast.Provider>
    </ToastContext.Provider>
  );
}
