'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, Clock, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type SnackbarType = 'success' | 'pending' | 'warning' | 'error' | 'info';

export interface SnackbarMessage {
  id: string;
  title: string;
  description?: string;
  type: SnackbarType;
  durationMs?: number;
}

interface SnackbarContextType {
  showSnackbar: (message: Omit<SnackbarMessage, 'id'>) => void;
  dismissSnackbar: (id: string) => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<SnackbarMessage[]>([]);

  const dismissSnackbar = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const showSnackbar = useCallback((msg: Omit<SnackbarMessage, 'id'>) => {
    const id = `snack-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newMsg: SnackbarMessage = {
      ...msg,
      id,
      durationMs: msg.durationMs ?? 4500,
    };

    setMessages((prev) => [...prev.slice(-3), newMsg]); // keep up to 4 latest

    if (newMsg.durationMs && newMsg.durationMs > 0) {
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }, newMsg.durationMs);
    }
  }, []);

  return (
    <SnackbarContext.Provider value={{ showSnackbar, dismissSnackbar }}>
      {children}
      {/* Toast / Snackbar Floating Viewport */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {messages.map((item) => {
          let toneStyles = 'bg-slate-900 text-white border-slate-800';
          let icon = <Info className="w-5 h-5 text-blue-400 shrink-0" />;

          if (item.type === 'success') {
            toneStyles = 'bg-emerald-950/95 text-emerald-50 border-emerald-800 shadow-emerald-950/20';
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
          } else if (item.type === 'pending') {
            toneStyles = 'bg-amber-950/95 text-amber-50 border-amber-800 shadow-amber-950/20';
            icon = <Clock className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />;
          } else if (item.type === 'warning') {
            toneStyles = 'bg-yellow-950/95 text-yellow-50 border-yellow-800 shadow-yellow-950/20';
            icon = <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />;
          } else if (item.type === 'error') {
            toneStyles = 'bg-rose-950/95 text-rose-50 border-rose-800 shadow-rose-950/20';
            icon = <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
          }

          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100 ${toneStyles}`}
            >
              <div className="pt-0.5">{icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black leading-tight tracking-wide">{item.title}</p>
                {item.description && (
                  <p className="text-[11px] opacity-80 mt-1 leading-relaxed break-words">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismissSnackbar(item.id)}
                className="opacity-60 hover:opacity-100 transition-opacity p-0.5 -mr-1 -mt-1 text-inherit"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return context;
}
