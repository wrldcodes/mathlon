'use client';

import type { ReactNode } from 'react';
import { DisplayNameProvider } from '../hooks/useDisplayName';
import { VoiceProviderRoot } from '../voice/useVoice';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <DisplayNameProvider>
      <VoiceProviderRoot>{children}</VoiceProviderRoot>
    </DisplayNameProvider>
  );
}
