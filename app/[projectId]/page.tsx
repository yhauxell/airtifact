import { list } from '@vercel/blob';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  try {
    const { blobs } = await list({ prefix: 'projects/' });
    
    // Extract unique project IDs from metadata.json files
    const projectIds = new Set<string>();
    for (const blob of blobs) {
      const match = blob.pathname.match(/^projects\/([a-f0-9]+)\/metadata\.json$/);
      if (match) {
        projectIds.add(match[1]);
      }
    }

    return Array.from(projectIds).map((id) => ({ projectId: id }));
  } catch (error) {
    console.error('[v0] Error generating params:', error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return {
    title: `Project ${projectId.slice(0, 8)}`,
    description: 'Uploaded project',
  };
}

async function getProjectIndex(projectId: string): Promise<string | null> {
  try {
    const { blobs } = await list({
      prefix: `projects/${projectId}/`,
    });

    const indexBlob = blobs.find(
      (blob) => blob.pathname === `projects/${projectId}/index.html`
    );

    if (!indexBlob) {
      return null;
    }

    const response = await fetch(indexBlob.url);
    return await response.text();
  } catch (error) {
    console.error('[v0] Error fetching index:', error);
    return null;
  }
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const indexHtml = await getProjectIndex(projectId);

  if (!indexHtml) {
    notFound();
  }

  // This component will render the uploaded HTML with a base URL for relative asset serving
  return (
    <div>
      <iframe
        srcDoc={indexHtml.replace(
          /<head>/i,
          `<head><base href="/${projectId}/">`
        )}
        style={{
          width: '100%',
          height: '100vh',
          border: 'none',
        }}
        title="Uploaded Project"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
