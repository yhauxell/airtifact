'use client';

import { useEffect, useState } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  const copyToClipboard = (projectId: string) => {
    const url = `${window.location.origin}/${projectId}`;
    navigator.clipboard.writeText(url);
    setCopied(projectId);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Project Dashboard
        </h1>
        <p className="text-muted-foreground mb-8">
          {projects.length} project{projects.length !== 1 ? 's' : ''} uploaded
        </p>

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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
