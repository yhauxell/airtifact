'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, LoaderCircle, Trash2 } from 'lucide-react';

const REDIRECT_DELAY_SECONDS = 5;

export default function RemoveProjectPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = Array.isArray(params.projectId)
    ? params.projectId[0]
    : params.projectId;
  const tokenFromUrl = searchParams.get('t')?.trim() ?? '';

  const [tokenInput, setTokenInput] = useState(tokenFromUrl);
  const [deleteToken, setDeleteToken] = useState(tokenFromUrl);
  const [dialogOpen, setDialogOpen] = useState(!tokenFromUrl);
  const [submittingToken, setSubmittingToken] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [redirectSeconds, setRedirectSeconds] = useState(REDIRECT_DELAY_SECONDS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTokenInput(tokenFromUrl);
    setDeleteToken(tokenFromUrl);
    setDialogOpen(!tokenFromUrl);
    setError(null);
  }, [tokenFromUrl]);

  useEffect(() => {
    if (!deleted) {
      return;
    }

    setRedirectSeconds(REDIRECT_DELAY_SECONDS);
    const interval = window.setInterval(() => {
      setRedirectSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          router.replace('/');
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [deleted, router]);

  const tokenSummary = useMemo(() => {
    if (!deleteToken) {
      return 'No token provided yet';
    }

    if (tokenFromUrl && deleteToken === tokenFromUrl) {
      return 'Secret token loaded from the URL';
    }

    return 'Secret token entered manually';
  }, [deleteToken, tokenFromUrl]);

  const handleTokenConfirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextToken = tokenInput.trim();

    if (!nextToken) {
      setError('Enter the secret token to continue');
      return;
    }

    setSubmittingToken(true);
    setDeleteToken(nextToken);
    setDialogOpen(false);
    setError(null);
    setSubmittingToken(false);
  };

  const handleDelete = async () => {
    if (!deleteToken) {
      setDialogOpen(true);
      setError('Enter the secret token to continue');
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(`/api/projects/${projectId}/remove`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: deleteToken }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to delete project');
      }

      setDeleted(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-16 text-foreground">
      {dialogOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-muted p-2 text-muted-foreground">
                <KeyRound className="size-4" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Enter secret token</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Paste the removal token for project <span className="font-mono text-xs">{projectId}</span>.
                </p>
              </div>
            </div>

            <form onSubmit={handleTokenConfirm} className="space-y-4">
              <input
                type="text"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder="Secret token"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
                autoComplete="off"
              />
              <div className="flex items-center justify-end gap-2">
                <Link
                  href="/"
                  className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submittingToken}
                  className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="w-full max-w-lg">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to uploader
        </Link>

        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
          {!deleted ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Remove project
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">
                  Permanently delete this upload?
                </h2>
                <p className="text-sm text-muted-foreground">
                  This removes the project and all uploaded files. This action cannot be undone.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4 text-sm">
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Project ID</p>
                    <p className="mt-1 font-mono text-xs text-foreground break-all">{projectId}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Authorization</p>
                    <p className="mt-1 text-foreground">{tokenSummary}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setTokenInput(deleteToken);
                    setDialogOpen(true);
                    setError(null);
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  {deleteToken ? 'Change token' : 'Enter token'}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-4" />
                      Delete project
                    </>
                  )}
                </button>
              </div>

              {error && (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="size-7" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Project deleted</h1>
                <p className="text-sm text-muted-foreground">
                  The project and its uploaded files were removed successfully.
                </p>
                <p className="text-sm text-muted-foreground">
                  Redirecting to the landing page in {redirectSeconds} second{redirectSeconds === 1 ? '' : 's'}...
                </p>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85"
              >
                Return now
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
