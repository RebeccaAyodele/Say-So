import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Generating replies…' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-surface-border animate-spin border-t-brand-400" />
        <Loader2
          size={20}
          className="absolute inset-0 m-auto text-brand-400 animate-pulse"
        />
      </div>
      <p className="text-sm text-gray-400 animate-pulse">{message}</p>
    </div>
  );
}
