import { Suspense } from 'react';
import { BillingPage } from '../../components/BillingPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BillingPage />
    </Suspense>
  );
}
