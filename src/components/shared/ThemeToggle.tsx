'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from './ThemeProvider';
import { Sun, Moon, Laptop, Check } from 'lucide-react';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = [
    { value: 'light', label: 'LIGHT', icon: Sun },
    { value: 'dark', label: 'DARK', icon: Moon },
    { value: 'system', label: 'SYSTEM', icon: Laptop },
  ] as const;

  const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun;

  if (compact) {
    return (
      <div className="relative inline-flex" ref={menuRef}>
        <button
          onClick={() => setOpen(!open)}
          aria-label="Toggle theme mode"
          className="relative flex items-center justify-center w-9 h-9 border-2 border-border bg-surface text-foreground font-bold hover:translate-x-[-1px] hover:translate-y-[-1px] shadow-[2px_2px_0px_0px_var(--border)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
        >
          <CurrentIcon className="w-4 h-4" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-36 border-2 border-border bg-surface shadow-[4px_4px_0px_0px_var(--border)] p-1 z-50 text-xs font-mono">
            {options.map((opt) => {
              const Icon = opt.icon;
              const isSelected = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    setTheme(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 font-bold transition-colors ${
                    isSelected
                      ? 'bg-foreground text-background'
                      : 'text-foreground hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Segmented Neobrutalist Block Controller
  return (
    <div className="inline-flex items-center p-1 border-2 border-border bg-surface shadow-[3px_3px_0px_0px_var(--border)] text-xs font-mono">
      {options.map((opt) => {
        const Icon = opt.icon;
        const isSelected = theme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`flex items-center gap-1.5 px-3 py-1 font-extrabold text-xs transition-all ${
              isSelected
                ? 'bg-foreground text-background shadow-[1px_1px_0px_0px_var(--border)]'
                : 'text-foreground hover:bg-surface-hover'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
