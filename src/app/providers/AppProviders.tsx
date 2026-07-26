'use client';

import type { ReactNode } from 'react';
import { DisplayNameProvider } from '../hooks/useDisplayName';
import { VoiceProviderRoot } from '../voice/useVoice';
import { MobileGate } from '../components/MobileGate';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <DisplayNameProvider>
      <VoiceProviderRoot>
        <MobileGate>{children}</MobileGate>
      </VoiceProviderRoot>
    </DisplayNameProvider>
  );
}
