'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ArrowUpDown, Search } from 'lucide-react';

interface UserData {
  username: string;
  createdAt: string;
  isBlocked: boolean;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleToggleBlock = async (username: string, currentStatus: boolean) => {
    try {
      setActionLoading(`block-${username}`);
      const response = await fetch(`/api/admin/users/${username}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: !currentStatus })
      });
      if (!response.ok) throw new Error('Failed to update user status');
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (username: string) => {
    if (!confirm(`Are you sure you want to completely remove user '${username}' and all their projects? This action cannot be undone.`)) return;
    
    try {
      setActionLoading(`remove-${username}`);
      const response = await fetch(`/api/admin/users/${username}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove user');
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAndSortedUsers = users
    .filter(user => user.username.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Users</h1>
          <p className="text-muted-foreground">
            {users.length} registered user{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-border bg-card rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <button
            onClick={handleSort}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border bg-card border-border text-foreground hover:bg-accent`}
          >
            Sort Date <ArrowUpDown className="size-4" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading users...</div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-destructive">
          Error: {error}
        </div>
      )}

      {!loading && users.length === 0 && (
        <div className="rounded-lg bg-card border border-border p-8 text-center text-muted-foreground">
          No users registered yet
        </div>
      )}

      {!loading && users.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4">Username</th>
                  <th className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors" onClick={handleSort}>
                    <div className="flex items-center gap-2">
                      Registration Date
                      <ArrowUpDown className="size-3" />
                    </div>
                  </th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedUsers.length > 0 ? (
                  filteredAndSortedUsers.map(user => (
                    <tr key={user.username} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-6 py-4 font-medium">{user.username}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {format(new Date(user.createdAt), 'MMMM d, yyyy h:mm a')}
                      </td>
                      <td className="px-6 py-4">
                        {user.isBlocked ? (
                          <span className="bg-red-500/10 text-red-500 px-2 py-1 rounded-md text-xs font-medium">Blocked</span>
                        ) : (
                          <span className="bg-green-500/10 text-green-500 px-2 py-1 rounded-md text-xs font-medium">Active</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleToggleBlock(user.username, user.isBlocked)}
                          disabled={actionLoading !== null}
                          className="text-xs px-3 py-1.5 rounded-md border border-border bg-card hover:bg-accent disabled:opacity-50"
                        >
                          {actionLoading === `block-${user.username}` ? '...' : (user.isBlocked ? 'Unblock' : 'Block')}
                        </button>
                        <button
                          onClick={() => handleRemove(user.username)}
                          disabled={actionLoading !== null}
                          className="text-xs px-3 py-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                        >
                          {actionLoading === `remove-${user.username}` ? '...' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                      No users match your search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
