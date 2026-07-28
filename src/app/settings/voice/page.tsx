import { Suspense } from 'react';
import { VoiceSettingsPage } from '../../components/VoiceSettingsPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VoiceSettingsPage />
    </Suspense>
  );
}
