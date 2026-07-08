'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { Trash2, Copy } from 'lucide-react';

interface ProjectMetadata {
  projectId: string;
  uploadDate: string;
  fileName: string;
  fileCount: number;
  files: string[];
}

export default function AdminPage() {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/admin/auth').then((res) => {
      if (res.ok) setIsAuthenticated(true);
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
    }
  }, [isAuthenticated]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data.projects || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

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
      setError(null);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to authenticate');
    } finally {
      setAuthenticating(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!isAuthenticated) {
      return;
    }

    if (confirmations[projectId] !== projectId) {
      setError(`Confirmation text must match project ID: ${projectId}`);
      return;
    }

    try {
      setDeletingProjectId(projectId);
      const response = await fetch(`/api/admin/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to remove project');
      }

      setConfirmations((previous) => {
        const next = { ...previous };
        delete next[projectId];
        return next;
      });
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove project');
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleLock = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    setIsAuthenticated(false);
    setPassword('');
    setProjects([]);
    setAuthError(null);
    setError(null);
    setConfirmations({});
  };

  const copyToClipboard = (projectId: string) => {
    const url = `${window.location.origin}/${projectId}`;
    navigator.clipboard.writeText(url);
    setCopied(projectId);
    setTimeout(() => setCopied(null), 2000);
  };

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
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="mb-2 text-4xl font-bold text-foreground">
              Project Dashboard
            </h1>
            <p className="text-muted-foreground">
              {projects.length} project{projects.length !== 1 ? 's' : ''} uploaded
            </p>
          </div>
          <button
            onClick={handleLock}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-accent"
          >
            Lock Dashboard
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading projects...</div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-destructive mb-8">
            Error: {error}
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="rounded-lg bg-card border border-border p-8 text-center text-muted-foreground">
            No projects uploaded yet
          </div>
        )}

        {!loading && projects.length > 0 && (
          <div className="space-y-4">
            {projects.map((project) => (
              <div
                key={project.projectId}
                className="rounded-lg bg-card border border-border p-6 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1 font-mono text-sm break-all">
                      {project.projectId}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {project.fileName} • {project.fileCount} file
                      {project.fileCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Uploaded{' '}
                      {format(new Date(project.uploadDate), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(project.projectId)}
                    className="ml-4 inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90 transition-opacity"
                  >
                    <Copy className="size-4" />
                    {copied === project.projectId ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                    Files ({project.fileCount})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {project.files.slice(0, 10).map((file) => (
                      <p
                        key={file}
                        className="text-xs text-muted-foreground font-mono break-all"
                      >
                        {file}
                      </p>
                    ))}
                    {project.files.length > 10 && (
                      <p className="text-xs text-muted-foreground">
                        +{project.files.length - 10} more
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-4 flex gap-2">
                  <a
                    href={`/${project.projectId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-md bg-secondary text-secondary-foreground px-3 py-2 text-sm hover:opacity-90 transition-opacity"
                  >
                    View Project
                  </a>
                  <div className="flex flex-1 flex-col gap-2 md:flex-row">
                    <input
                      type="text"
                      value={confirmations[project.projectId] || ''}
                      onChange={(event) =>
                        setConfirmations((previous) => ({
                          ...previous,
                          [project.projectId]: event.target.value,
                        }))
                      }
                      placeholder="Enter project ID to confirm"
                      className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      onClick={() => handleDelete(project.projectId)}
                      disabled={deletingProjectId === project.projectId}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="size-4" />
                      {deletingProjectId === project.projectId
                        ? 'Removing...'
                        : 'Remove Project'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
