'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authenticating, setAuthenticating] = useState(false);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/admin/auth').then((res) => {
      if (res.ok) {
        setIsAuthenticated(true);
      }
      setIsChecking(false);
    });
  }, []);

  const handleAuthenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!password) {
      setAuthError('Password is required');
      return;
    }

    try {
      setAuthenticating(true);
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Invalid password');
      }

      setIsAuthenticated(true);
      setAuthError(null);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to authenticate');
    } finally {
      setAuthenticating(false);
    }
  };

  const handleLock = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    setIsAuthenticated(false);
    setPassword('');
    setAuthError(null);
  };

  if (isChecking) {
    return <div className="min-h-screen bg-background p-8 flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-6">
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            Admin Access
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Enter the manage password to access the dashboard.
          </p>

          <form onSubmit={handleAuthenticate} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Manage password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoComplete="current-password"
              disabled={authenticating}
            />
            <button
              type="submit"
              disabled={authenticating}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {authenticating ? 'Verifying...' : 'Open Dashboard'}
            </button>
          </form>

          {authError && (
            <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {authError}
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <span className="text-xl font-bold">Admin</span>
              </div>
              <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/admin"
                  className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                    pathname === '/admin'
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/users"
                  className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                    pathname === '/admin/users'
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                  }`}
                >
                  Users
                </Link>
                <Link
                  href="/admin/projects"
                  className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                    pathname === '/admin/projects'
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                  }`}
                >
                  Projects
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLock}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none"
              >
                Lock Dashboard
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
