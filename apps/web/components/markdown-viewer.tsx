'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  FileText,
  Sun,
  Moon,
  Menu,
  X,
  Search,
  ChevronRight,
  List,
  ExternalLink,
} from 'lucide-react';
import type { DocNavItem, TocHeading } from '@/lib/markdown';

interface MarkdownViewerProps {
  projectId: string;
  projectTitle: string;
  currentFilePath: string;
  currentRoutePath: string;
  documentTitle: string;
  html: string;
  toc: TocHeading[];
  navItems: DocNavItem[];
  isBlocked?: boolean;
}

export default function MarkdownViewer({
  projectId,
  projectTitle,
  currentFilePath,
  currentRoutePath,
  documentTitle,
  html,
  toc,
  navItems,
  isBlocked,
}: MarkdownViewerProps) {
  const [isDark, setIsDark] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeHeadingId, setActiveHeadingId] = useState<string>(toc[0]?.id || '');
  const articleRef = useRef<HTMLElement>(null);

  const isMultiDoc = navItems.length > 1;

  // Sync dark mode state with document.documentElement
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const nextDark = !root.classList.contains('dark');
    root.classList.toggle('dark', nextDark);
    try {
      localStorage.setItem('theme', nextDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
    setIsDark(nextDark);
  };

  // Handle Copy Code buttons via event delegation
  useEffect(() => {
    const container = articleRef.current;
    if (!container) return;

    const handleClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const copyBtn = target.closest('.copy-code-btn') as HTMLButtonElement | null;
      if (!copyBtn) return;

      const encoded = copyBtn.getAttribute('data-code');
      if (!encoded) return;

      try {
        const binary = atob(encoded);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const decoded = new TextDecoder('utf-8').decode(bytes);
        await navigator.clipboard.writeText(decoded);

        const labelEl = copyBtn.querySelector('.copy-label');
        if (labelEl) {
          const prevText = labelEl.textContent;
          labelEl.textContent = 'Copied!';
          copyBtn.classList.add('border-emerald-500/60', 'text-emerald-300');
          setTimeout(() => {
            labelEl.textContent = prevText || 'Copy';
            copyBtn.classList.remove('border-emerald-500/60', 'text-emerald-300');
          }, 2000);
        }
      } catch (err) {
        console.error('Failed to copy code:', err);
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [html]);

  // Render Mermaid diagrams dynamically when html or theme changes
  useEffect(() => {
    const container = articleRef.current;
    if (!container) return;

    const mermaidNodes = container.querySelectorAll<HTMLElement>('.mermaid-diagram[data-mermaid]');
    if (mermaidNodes.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'strict',
          fontFamily: 'var(--font-sans), sans-serif',
        });

        for (let i = 0; i < mermaidNodes.length; i++) {
          if (cancelled) return;
          const node = mermaidNodes[i];
          const encoded = node.getAttribute('data-mermaid');
          if (!encoded) continue;

          const binary = atob(encoded);
          const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
          const definition = new TextDecoder('utf-8').decode(bytes);

          try {
            const id = `mermaid-svg-${projectId.slice(0, 6)}-${i}-${Date.now()}`;
            const { svg } = await mermaid.render(id, definition);
            if (!cancelled) {
              node.innerHTML = svg;
            }
          } catch (renderErr) {
            console.warn('Mermaid diagram render warning:', renderErr);
          }
        }
      } catch (err) {
        console.warn('Failed to load mermaid:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [html, isDark, projectId]);

  // Track active heading in TOC on scroll
  useEffect(() => {
    if (toc.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHeadingId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );

    for (const item of toc) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [toc]);

  const filteredNavItems = useMemo(() => {
    if (!searchQuery.trim()) return navItems;
    const q = searchQuery.toLowerCase();
    return navItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.filePath.toLowerCase().includes(q) ||
        (item.section && item.section.toLowerCase().includes(q))
    );
  }, [navItems, searchQuery]);

  // Group nav items by section
  const groupedNav = useMemo(() => {
    const groups: { section: string | null; items: DocNavItem[] }[] = [];
    const map = new Map<string | null, DocNavItem[]>();

    for (const item of filteredNavItems) {
      const key = item.section || null;
      if (!map.has(key)) {
        const arr: DocNavItem[] = [];
        map.set(key, arr);
        groups.push({ section: key, items: arr });
      }
      map.get(key)!.push(item);
    }

    return groups;
  }, [filteredNavItems]);

  // Find previous / next page for docset pagination
  const currentNavIndex = navItems.findIndex((item) => item.filePath === currentFilePath);
  const prevDoc = currentNavIndex > 0 ? navItems[currentNavIndex - 1] : null;
  const nextDoc =
    currentNavIndex !== -1 && currentNavIndex < navItems.length - 1
      ? navItems[currentNavIndex + 1]
      : null;

  const getDocHref = (item: DocNavItem) =>
    item.routePath ? `/${projectId}/${item.routePath}` : `/${projectId}`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {isBlocked && (
        <div className="bg-red-600 text-white text-center py-2 font-medium shadow-md text-sm z-50">
          Project is under review for removal.
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            {isMultiDoc && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
                aria-label="Toggle documentation navigation"
              >
                {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            )}
            <Link
              href={`/${projectId}`}
              className="flex items-center gap-2 font-semibold text-foreground truncate hover:opacity-80 transition-opacity"
            >
              <BookOpen className="size-4 shrink-0 text-primary" />
              <span className="truncate">{projectTitle}</span>
            </Link>
            {isMultiDoc && (
              <span className="hidden sm:inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                {navItems.length} docs
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/projects/${projectId}/${currentFilePath}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="View raw Markdown source"
            >
              <FileText className="size-3.5" />
              Raw .md
            </a>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-full border border-border bg-background p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Toggle color theme"
            >
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background shadow-xs transition-opacity hover:opacity-90"
            >
              <span>Built with Airtifact</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="mx-auto flex w-full max-w-7xl flex-1">
        {/* Left Sidebar for Multi-Document Docsets */}
        {isMultiDoc && (
          <>
            {/* Mobile backdrop */}
            {mobileMenuOpen && (
              <div
                className="fixed inset-0 z-20 bg-black/50 lg:hidden"
                onClick={() => setMobileMenuOpen(false)}
              />
            )}

            <aside
              className={`fixed inset-y-0 left-0 top-14 z-20 w-72 shrink-0 overflow-y-auto border-r border-border bg-background p-4 transition-transform lg:static lg:translate-x-0 ${
                mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
              aria-label="Documentation Sidebar"
            >
              {/* Search Filter */}
              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter documents..."
                  className="w-full rounded-lg border border-border bg-muted/40 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <nav className="space-y-5">
                {groupedNav.map((group, gIdx) => (
                  <div key={group.section || `root-${gIdx}`} className="space-y-1">
                    {group.section && (
                      <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        {group.section}
                      </p>
                    )}
                    {group.items.map((item) => {
                      const isActive =
                        item.filePath === currentFilePath ||
                        item.routePath.toLowerCase() === currentRoutePath.toLowerCase();
                      return (
                        <Link
                          key={item.filePath}
                          href={getDocHref(item)}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                            isActive
                              ? 'bg-primary text-primary-foreground font-medium shadow-xs'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <FileText className="size-3.5 shrink-0 opacity-75" />
                          <span className="truncate">{item.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}

                {groupedNav.length === 0 && (
                  <p className="px-2.5 text-xs text-muted-foreground">
                    No matching documents found.
                  </p>
                )}
              </nav>
            </aside>
          </>
        )}

        {/* Center Document Content */}
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-3xl">
            {/* Breadcrumb for nested routes */}
            {isMultiDoc && currentFilePath && (
              <div className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <Link href={`/${projectId}`} className="hover:text-foreground transition-colors">
                  {projectTitle}
                </Link>
                <ChevronRight className="size-3.5" />
                <span className="text-foreground truncate">{currentFilePath}</span>
              </div>
            )}

            <article
              ref={articleRef}
              className="markdown-body"
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {/* Previous / Next Navigation Footer for Multi-File Docsets */}
            {isMultiDoc && (prevDoc || nextDoc) && (
              <div className="mt-14 grid grid-cols-1 gap-4 border-t border-border pt-6 sm:grid-cols-2">
                {prevDoc ? (
                  <Link
                    href={getDocHref(prevDoc)}
                    className="group flex flex-col rounded-xl border border-border p-4 transition-colors hover:border-foreground/30 hover:bg-muted/40"
                  >
                    <span className="text-xs text-muted-foreground">Previous</span>
                    <span className="mt-1 font-medium text-foreground group-hover:underline">
                      ← {prevDoc.title}
                    </span>
                  </Link>
                ) : (
                  <div />
                )}
                {nextDoc ? (
                  <Link
                    href={getDocHref(nextDoc)}
                    className="group flex flex-col items-end rounded-xl border border-border p-4 text-right transition-colors hover:border-foreground/30 hover:bg-muted/40"
                  >
                    <span className="text-xs text-muted-foreground">Next</span>
                    <span className="mt-1 font-medium text-foreground group-hover:underline">
                      {nextDoc.title} →
                    </span>
                  </Link>
                ) : (
                  <div />
                )}
              </div>
            )}
          </div>
        </main>

        {/* Right Table of Contents (On This Page) */}
        {toc.length > 1 && (
          <aside
            className="hidden xl:block w-64 shrink-0 px-4 py-8"
            aria-label="Table of contents"
          >
            <div className="sticky top-22 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
              <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <List className="size-3.5" />
                <span>On this page</span>
              </div>
              <ul className="space-y-1.5 text-xs border-l border-border">
                {toc.map((heading) => {
                  const isActive = activeHeadingId === heading.id;
                  const indentClass =
                    heading.level === 1
                      ? 'pl-3 font-medium'
                      : heading.level === 2
                      ? 'pl-3'
                      : heading.level === 3
                      ? 'pl-6'
                      : 'pl-8';
                  return (
                    <li key={heading.id}>
                      <a
                        href={`#${heading.id}`}
                        onClick={() => setActiveHeadingId(heading.id)}
                        className={`block py-0.5 transition-colors border-l-2 -ml-px ${indentClass} ${
                          isActive
                            ? 'border-foreground text-foreground font-medium'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {heading.text}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
