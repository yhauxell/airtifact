import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getStorageAdapter } from '@/lib/storage';
import {
  renderMarkdownDocument,
  resolveMarkdownFileForRoute,
  buildDocsetNavigation,
  filePathToRoutePath,
  formatDocTitleFromPath,
} from '@/lib/markdown';
import MarkdownViewer from '@/components/markdown-viewer';

export const dynamic = 'force-dynamic';

interface ProjectMetadata {
  projectId: string;
  projectType?: 'html' | 'markdown';
  title?: string;
  fileName?: string;
  files?: string[];
  owner?: string;
}

async function getProjectMetadata(projectId: string): Promise<{
  metadata: ProjectMetadata | null;
  isBlocked: boolean;
}> {
  let metadata: ProjectMetadata | null = null;
  let isBlocked = false;

  try {
    const storage = getStorageAdapter();
    const metadataContent = await storage.getContent(`projects/${projectId}/metadata.json`);
    if (metadataContent) {
      metadata = JSON.parse(metadataContent.toString('utf-8'));
      if (metadata?.owner) {
        const userContent = await storage.getContent(`users/${metadata.owner}/profile.json`);
        if (userContent) {
          const userProfile = JSON.parse(userContent.toString('utf-8'));
          isBlocked = !!userProfile.isBlocked;
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch project metadata or block status:', err);
  }

  return { metadata, isBlocked };
}

async function getProjectFileText(projectId: string, filePath: string): Promise<string | null> {
  try {
    const content = await getStorageAdapter().getContent(`projects/${projectId}/${filePath}`);
    if (!content) return null;
    return content.toString('utf-8');
  } catch (error) {
    console.error('[v0] Error fetching project file:', error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string; slug: string[] }>;
}) {
  const { projectId, slug } = await params;
  const { metadata } = await getProjectMetadata(projectId);
  const files = metadata?.files || [];
  const targetMdFile = resolveMarkdownFileForRoute(files, slug);

  const pageTitle = targetMdFile
    ? formatDocTitleFromPath(targetMdFile)
    : slug.join(' / ');
  const projectTitle =
    metadata?.title ||
    (metadata?.fileName ? metadata.fileName.replace(/\.(zip|md|markdown)$/i, '') : null) ||
    `Project ${projectId.slice(0, 8)}`;

  return {
    title: `${pageTitle} — ${projectTitle}`,
    description: 'Published Markdown documentation on Airtifact',
  };
}

export default async function ProjectSubRoutePage({
  params,
}: {
  params: Promise<{ projectId: string; slug: string[] }>;
}) {
  const { projectId, slug } = await params;
  const { metadata, isBlocked } = await getProjectMetadata(projectId);

  if (!metadata) {
    notFound();
  }

  const files = metadata.files || [];

  // 1. Try resolving as a Markdown document in the docset
  const targetMdFile = resolveMarkdownFileForRoute(files, slug);
  if (targetMdFile) {
    const rawMarkdown = await getProjectFileText(projectId, targetMdFile);
    if (rawMarkdown !== null) {
      const rendered = renderMarkdownDocument(rawMarkdown, {
        projectId,
        currentFilePath: targetMdFile,
        allFiles: files,
        fallbackTitle: formatDocTitleFromPath(targetMdFile),
      });

      const navItems = buildDocsetNavigation(files, {
        [targetMdFile]: rendered.title,
      });

      const projectTitle =
        metadata.title ||
        (metadata.fileName
          ? formatDocTitleFromPath(metadata.fileName.replace(/\.zip$/i, ''))
          : rendered.title);

      return (
        <MarkdownViewer
          projectId={projectId}
          projectTitle={projectTitle}
          currentFilePath={targetMdFile}
          currentRoutePath={filePathToRoutePath(targetMdFile)}
          documentTitle={rendered.title}
          html={rendered.html}
          toc={rendered.toc}
          navItems={navItems}
          isBlocked={isBlocked}
        />
      );
    }
  }

  // 2. Also support sub-route HTML pages if the project contains nested .html files
  const candidateHtmlPaths = [
    slug.join('/'),
    `${slug.join('/')}.html`,
    `${slug.join('/')}/index.html`,
  ];

  for (const candidate of candidateHtmlPaths) {
    if (candidate.toLowerCase().endsWith('.html')) {
      const matchedHtml = files.find((f) => f.toLowerCase() === candidate.toLowerCase());
      if (matchedHtml) {
        const htmlContent = await getProjectFileText(projectId, matchedHtml);
        if (htmlContent) {
          return (
            <div className="relative">
              {isBlocked && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-center py-2 font-medium shadow-md text-sm">
                  Project is under review for removal.
                </div>
              )}
              <Link
                href="/"
                className="fixed right-3 top-3 z-20 rounded-full bg-black/75 px-3 py-1 text-xs font-medium text-white shadow-lg transition-opacity hover:opacity-90"
              >
                Built with Airtifact · Create your own
              </Link>
              <iframe
                srcDoc={htmlContent.replace(
                  /<head>/i,
                  `<head><base href="/api/projects/${projectId}/">`
                )}
                style={{
                  width: '100%',
                  height: '100vh',
                  border: 'none',
                }}
                title="Uploaded Project"
                sandbox="allow-scripts allow-forms allow-popups allow-modals"
              />
            </div>
          );
        }
      }
    }
  }

  notFound();
}
