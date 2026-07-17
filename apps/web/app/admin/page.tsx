'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';

interface DashboardMetrics {
  totalUsers: number;
  totalProjectsAuth: number;
  totalProjectsAnon: number;
  topUsers: { username: string; projectCount: number }[];
  latestProjects: { projectId: string; url: string; uploadDate: string; fileName: string }[];
  totalUploadSize: number;
  biggestProject: { projectId: string; url: string; size: number; fileName: string } | null;
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard metrics');
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${mb.toFixed(2)} MB`;
  };

  if (loading) {
    return <div className="text-muted-foreground p-8">Loading dashboard metrics...</div>;
  }

  if (error) {
    return <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-destructive m-8">Error: {error}</div>;
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-lg bg-card border border-border p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Users</h3>
          <p className="text-3xl font-bold">{metrics.totalUsers}</p>
        </div>
        <div className="rounded-lg bg-card border border-border p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Projects (Auth vs Anon)</h3>
          <p className="text-3xl font-bold">
            {metrics.totalProjectsAuth} <span className="text-lg text-muted-foreground font-normal">/ {metrics.totalProjectsAnon}</span>
          </p>
        </div>
        <div className="rounded-lg bg-card border border-border p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Upload Size</h3>
          <p className="text-3xl font-bold">{formatSize(metrics.totalUploadSize)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="rounded-lg bg-card border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Top 5 Users (Projects Created)</h3>
          {metrics.topUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users have uploaded projects yet.</p>
          ) : (
            <div className="space-y-4">
              {metrics.topUsers.map((user, i) => (
                <div key={user.username} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">{i + 1}.</span>
                    <span className="font-medium">{user.username}</span>
                  </div>
                  <span className="bg-primary/10 text-primary px-2 py-1 rounded-md text-sm font-medium">
                    {user.projectCount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-card border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Biggest Uploaded Project</h3>
          {metrics.biggestProject ? (
            <div className="space-y-2">
              <p className="font-medium truncate text-lg">
                <Link href={metrics.biggestProject.url} target="_blank" className="hover:underline text-primary">
                  {metrics.biggestProject.projectId}
                </Link>
              </p>
              <p className="text-sm text-muted-foreground">File: {metrics.biggestProject.fileName}</p>
              <p className="text-2xl font-bold">{formatSize(metrics.biggestProject.size)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No projects uploaded yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-card border border-border p-6 mt-8">
        <h3 className="text-lg font-semibold mb-4">Latest 5 Projects</h3>
        {metrics.latestProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3">Project ID</th>
                  <th className="px-4 py-3">File Name</th>
                  <th className="px-4 py-3">Upload Date</th>
                  <th className="px-4 py-3">Link</th>
                </tr>
              </thead>
              <tbody>
                {metrics.latestProjects.map(project => (
                  <tr key={project.projectId} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 font-mono">{project.projectId}</td>
                    <td className="px-4 py-3">{project.fileName}</td>
                    <td className="px-4 py-3">{format(new Date(project.uploadDate), 'MMM d, yyyy h:mm a')}</td>
                    <td className="px-4 py-3">
                      <Link href={project.url} target="_blank" className="text-primary hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
