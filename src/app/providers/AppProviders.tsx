'use client';

import type { ReactNode } from 'react';
import { VoiceProviderRoot } from '../voice/useVoice';

export function AppProviders({ children }: { children: ReactNode }) {
  return <VoiceProviderRoot>{children}</VoiceProviderRoot>;
}
