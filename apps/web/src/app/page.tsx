import { redirect } from 'next/navigation';

/** Send first visit to the install page so phones see install steps immediately. */
export default function HomePage() {
  redirect('/app');
}
