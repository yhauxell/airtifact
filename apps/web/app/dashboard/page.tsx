import { cookies } from 'next/headers';
import { validateUserSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import DashboardClient from './client';
import { getUser } from '@/lib/user-store';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('auth_session')?.value;
  
  const username = validateUserSession(sessionCookie);

  if (!username) {
    redirect('/login');
  }

  const user = await getUser(username);
  if (!user) {
    // Edge case where token is valid but user was deleted
    redirect('/login');
  }

  return <DashboardClient username={username} />;
}
