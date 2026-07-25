import { redirect } from 'next/navigation';

/** Legacy bare `/session` — sessions now live at `/session/[sessionId]`. */
export default function LegacySessionPage() {
  redirect('/');
}
