import { Suspense } from 'react';
import { SessionPage } from '../../components/SessionPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SessionPage />
    </Suspense>
  );
}
