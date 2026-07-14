import { list } from '@vercel/blob';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

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
  
  let isBlocked = false;
  try {
    const { blobs } = await list({ prefix: `projects/${projectId}/metadata.json` });
    if (blobs.length > 0) {
      const response = await fetch(blobs[0].url, { cache: 'no-store' });
      const metadata = await response.json();
      if (metadata.owner) {
        const userBlobs = await list({ prefix: `users/${metadata.owner}/profile.json` });
        if (userBlobs.blobs.length > 0) {
          const userResponse = await fetch(userBlobs.blobs[0].url, { cache: 'no-store' });
          const userProfile = await userResponse.json();
          isBlocked = !!userProfile.isBlocked;
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch user block status', err);
  }

  const indexHtml = await getProjectIndex(projectId);

  if (!indexHtml) {
    notFound();
  }

  // This component will render the uploaded HTML with a base URL for relative asset serving
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
        Built with Static Website Uploader · Create your own
      </Link>
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
        sandbox="allow-scripts allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
