'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Trash2, Copy, ArrowUpDown } from 'lucide-react';

interface ProjectMetadata {
  projectId: string;
  uploadDate: string;
  fileName: string;
  fileCount: number;
  files: string[];
  size: number;
  owner?: string;
  isBlocked?: boolean;
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});
  
  // Sort states
  const [sortField, setSortField] = useState<'uploadDate' | 'size'>('uploadDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchProjects();
  }, []);

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

  const handleDelete = async (projectId: string) => {
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

  const copyToClipboard = (projectId: string) => {
    const url = `${window.location.origin}/${projectId}`;
    navigator.clipboard.writeText(url);
    setCopied(projectId);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${mb.toFixed(2)} MB`;
  };

  const handleSort = (field: 'uploadDate' | 'size') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedProjects = [...projects].sort((a, b) => {
    if (sortField === 'size') {
      return sortDirection === 'asc' ? a.size - b.size : b.size - a.size;
    } else {
      return sortDirection === 'asc' 
        ? new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
        : new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Projects</h1>
          <p className="text-muted-foreground">
            {projects.length} project{projects.length !== 1 ? 's' : ''} uploaded
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => handleSort('uploadDate')}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border ${
              sortField === 'uploadDate' ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-foreground hover:bg-accent'
            }`}
          >
            Date <ArrowUpDown className="size-4" />
          </button>
          <button
            onClick={() => handleSort('size')}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border ${
              sortField === 'size' ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-foreground hover:bg-accent'
            }`}
          >
            Size <ArrowUpDown className="size-4" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading projects...</div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-destructive">
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
          {sortedProjects.map((project) => (
            <div
              key={project.projectId}
              className="rounded-lg bg-card border border-border p-6 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-foreground font-mono text-sm break-all">
                      {project.projectId}
                    </h3>
                    {project.owner ? (
                      <span className="bg-blue-500/10 text-blue-500 text-xs px-2 py-0.5 rounded-full font-medium">
                        Owner: {project.owner}
                      </span>
                    ) : (
                      <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                        Anonymous
                      </span>
                    )}
                    {project.isBlocked && (
                      <span className="bg-red-500/10 text-red-500 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        Owner Blocked
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {project.fileName} • {project.fileCount} file{project.fileCount !== 1 ? 's' : ''} • <span className="font-medium text-foreground">{formatSize(project.size || 0)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Uploaded {format(new Date(project.uploadDate), 'MMM d, yyyy h:mm a')}
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
  );
}
