'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Copy, Check, Trash2, Key, LogOut } from 'lucide-react';
import { DEFAULT_MAX_AUTH_UPLOAD_SIZE_BYTES } from '@/lib/upload-config';

interface DashboardClientProps {
  username: string;
}

const COPY_RESET_DELAY_MS = 2000;

export default function DashboardClient({ username }: DashboardClientProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [maxUploadSize, setMaxUploadSize] = useState(DEFAULT_MAX_AUTH_UPLOAD_SIZE_BYTES);

  useEffect(() => {
    fetch('/api/user/projects')
      .then((res) => res.json())
      .then((data) => {
        if (data.projects) setProjects(data.projects);
      })
      .finally(() => setLoading(false));

    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.maxAuthUploadSize) setMaxUploadSize(data.maxAuthUploadSize);
      })
      .catch(() => {});
  }, []);

  const generateApiKey = async () => {
    if (!confirm('Generating a new API Key will immediately revoke your old one. Continue?')) {
      return;
    }
    try {
      const res = await fetch('/api/user/apikey', { method: 'POST' });
      const data = await res.json();
      if (data.apiKey) {
        setApiKey(data.apiKey);
      }
    } catch (e) {
      alert('Failed to generate API Key');
    }
  };

  const deleteProject = async (projectId: string, deleteToken: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/remove?token=${deleteToken}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.projectId !== projectId));
      } else {
        alert('Failed to delete project');
      }
    } catch (e) {
      alert('Error deleting project');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/login', { method: 'DELETE' });
    window.location.href = '/';
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), COPY_RESET_DELAY_MS);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-8">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome, {username}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-medium hover:underline">
              Upload Page
            </Link>
            <button onClick={handleLogout} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </header>

        <section className="bg-card text-card-foreground border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Account Info</h2>
          <div className="text-sm">
            <p><strong>Upload Limit:</strong> {Math.round(maxUploadSize / (1024 * 1024))} MB</p>
          </div>
          <div className="pt-2">
            <button onClick={generateApiKey} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm hover:bg-primary/90">
              <Key className="w-4 h-4" /> Generate API Key
            </button>
            {apiKey && (
              <div className="mt-4 p-4 bg-muted rounded-md border flex items-center justify-between">
                <code className="text-xs break-all">{apiKey}</code>
                <button onClick={() => copyToClipboard(apiKey)} className="p-2 hover:bg-background rounded-md border ml-4 shrink-0">
                  {copiedKey ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}
            <details className="mt-4 bg-muted border rounded-md p-4 space-y-2 group">
              <summary className="text-sm font-semibold cursor-pointer select-none list-none flex items-center justify-between">
                How to use (JavaScript / fetch)
                <span className="transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="pt-2">
                <pre className="text-xs overflow-x-auto bg-background p-3 rounded border">
{`const formData = new FormData();
formData.append('file', fileInput.files[0]); // Must be a .zip file

const origin = "${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}` : process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : (typeof window !== 'undefined' ? window.location.origin : '')}";

fetch(origin + '/api/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${apiKey || '<YOUR_API_KEY>'}'
  },
  body: formData
})
.then(res => res.json())
.then(console.log);`}
                </pre>
              </div>
            </details>
            <p className="text-xs text-muted-foreground mt-4">
              Note: Generating a new key will instantly revoke the old one. You only ever have one active key.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Your Projects</h2>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : projects.length === 0 ? (
            <div className="p-12 border border-dashed rounded-lg text-center text-muted-foreground">
              <p>You haven't uploaded any projects yet.</p>
              <Link href="/" className="text-primary hover:underline mt-2 inline-block">Go upload one</Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {projects.map((project) => (
                <div key={project.projectId} className="flex items-center justify-between p-4 border rounded-lg bg-card text-card-foreground">
                  <div>
                    <h3 className="font-semibold">{project.fileName || project.projectId}</h3>
                    <div className="text-sm text-muted-foreground flex gap-4 mt-1">
                      <span>{new Date(project.uploadDate).toLocaleDateString()}</span>
                      <a href={`/${project.projectId}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">View Project</a>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteProject(project.projectId, project.deleteToken)}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                    title="Delete Project"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
