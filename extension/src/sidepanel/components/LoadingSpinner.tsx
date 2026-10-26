import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Generating replies…' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Loader2 size={22} className="animate-spin text-brand-400" />
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
