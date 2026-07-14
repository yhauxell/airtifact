import { cookies } from 'next/headers';
import { validateUserSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import AuthClient from '../login/client';

export default async function SignupPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('auth_session')?.value;
  
  if (validateUserSession(sessionCookie)) {
    redirect('/dashboard');
  }

  return <AuthClient mode="signup" />;
}
