'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Copy, Check, Star, Sun, Moon, ArrowRight, User } from 'lucide-react';
import { DEFAULT_MAX_ANON_UPLOAD_SIZE_BYTES } from '@/lib/upload-config';
import Link from 'next/link';

type Step = 'idle' | 'uploading' | 'success';

interface UploadResponse {
  projectId: string;
  shareUrl: string;
  removeUrl: string;
  deleteToken: string;
  files: string[];
}

const COPY_RESET_DELAY_MS = 2000;

type CopyField = 'share' | 'remove' | 'token' | 'snippet';
type SnippetTab = 'mcp' | 'curl' | 'js' | 'python';

const snippets: Record<SnippetTab, string> = {
  mcp: `// Add to mcp_config.json
{
  "mcpServers": {
    "airtifact": {
      "command": "npx",
      "args": ["-y", "@airtifact/mcp"],
      "env": {
        "AIRTIFACT_URL": "https://airtifact.page",
        "AIRTIFACT_AUTH_TOKEN": "YOUR_API_AUTH_TOKEN"
      }
    }
  }
}`,
  curl: `# Deploy a ZIP with index.html via cURL
curl -X POST https://airtifact.page/api/upload \\
  -H "Authorization: Bearer YOUR_API_AUTH_TOKEN" \\
  -F "file=@./build.zip"`,
  js: `import fs from 'node:fs';

const fileBuffer = fs.readFileSync('./build.zip');
const formData = new FormData();
formData.append('file', new Blob([fileBuffer]), 'build.zip');

const res = await fetch('https://airtifact.page/api/upload', {
  method: 'POST',
  headers: { Authorization: 'Bearer YOUR_API_AUTH_TOKEN' },
  body: formData,
});
const data = await res.json();
console.log('Live preview:', data.shareUrl);`,
  python: `import requests

with open('build.zip', 'rb') as f:
    res = requests.post(
        'https://airtifact.page/api/upload',
        headers={'Authorization': 'Bearer YOUR_API_AUTH_TOKEN'},
        files={'file': ('build.zip', f, 'application/zip')}
    )
print("Live preview:", res.json()['shareUrl'])`,
};

export default function Page() {
  const [step, setStep] = useState<Step>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [uploadedProject, setUploadedProject] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<CopyField | null>(null);
  const [activeSnippetTab, setActiveSnippetTab] = useState<SnippetTab>('mcp');
  const [maxUploadSizeBytes, setMaxUploadSizeBytes] = useState(DEFAULT_MAX_ANON_UPLOAD_SIZE_BYTES);
  const [starCount, setStarCount] = useState<number | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.5);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Sync dark state with what the inline script already applied
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.maxFileUploadSize === 'number') {
          setMaxUploadSizeBytes(data.maxFileUploadSize);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('https://api.github.com/repos/yhauxell/static-website-uploader')
      .then((res) => {
        if (!res.ok) return;
        return res.json();
      })
      .then((data) => {
        if (data && typeof data.stargazers_count === 'number') {
          setStarCount(data.stargazers_count);
        }
      })
      .catch(() => {});
  }, []);

  // Compute iframe preview scale from actual container width
  useEffect(() => {
    if (step === 'success' && previewContainerRef.current) {
      const w = previewContainerRef.current.offsetWidth;
      if (w > 0) setPreviewScale(w / 900);
    }
  }, [step]);

  const toggleTheme = () => {
    const html = document.documentElement;
    const newDark = !html.classList.contains('dark');
    html.classList.toggle('dark', newDark);
    try {
      localStorage.setItem('theme', newDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
    setIsDark(newDark);
  };

  const maxUploadSizeMB = maxUploadSizeBytes / (1024 * 1024);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFile(files[0]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) handleFile(files[0]);
  };

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please upload a ZIP file');
      return;
    }
    if (file.size > maxUploadSizeBytes) {
      setError(`File must be under ${maxUploadSizeMB}MB`);
      return;
    }

    setError(null);
    setUploadingFileName(file.name);
    setProgress(0);
    setStep('uploading');

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data: UploadResponse = JSON.parse(xhr.responseText);
          setUploadedProject(data);
          setStep('success');
        } catch {
          setError('Unexpected server response');
          setStep('idle');
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          setError(data.error || 'Upload failed');
        } catch {
          setError('Upload failed');
        }
        setStep('idle');
      }
    };

    xhr.onerror = () => {
      setError('Network error — please try again');
      setStep('idle');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    xhr.open('POST', '/api/upload');
    xhr.setRequestHeader('X-Web-Client', 'true');
    xhr.send(formData);
  };

  const copyToClipboard = async (value: string, field: CopyField) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField((current) => (current === field ? null : current)), COPY_RESET_DELAY_MS);
  };

  const reset = () => {
    setStep('idle');
    setUploadedProject(null);
    setError(null);
    setProgress(0);
    setCopiedField(null);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col">
      {/* Top-right controls */}
      <div className="fixed top-4 right-4 flex items-center gap-2 z-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Dashboard / Login"
        >
          <User className="size-4" />
        </Link>
        <a
          href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyhauxell%2Fairtifact"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <svg className="size-3 fill-current" viewBox="0 0 76 65" xmlns="http://www.w3.org/2000/svg"><path d="M37.5274 0L75.0548 65H0L37.5274 0Z"/></svg>
          Deploy
        </a>
        <a
          href="https://github.com/yhauxell/airtifact"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Star className="size-3" />
          Star
          {starCount !== null && (
            <span className="text-muted-foreground">{starCount}</span>
          )}
        </a>
        <button
          onClick={toggleTheme}
          className="rounded-full border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>

      {/* Main content */}
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-[28rem]">

          {/* Step 1 — Idle */}
          {step === 'idle' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1 text-center">
                <h1 className="text-4xl font-bold tracking-tight text-foreground">
                  Drop your site.
                </h1>
                <p className="text-muted-foreground">
                  Upload a ZIP, get a shareable link.
                </p>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-xl p-12 text-center transition-all duration-150 cursor-pointer border-2 ${
                  isDragging
                    ? 'border-dashed border-foreground bg-muted'
                    : 'border-transparent hover:border-dashed hover:border-border'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <div className="flex flex-col items-center gap-3">
                  <Upload
                    className={`size-10 transition-colors ${
                      isDragging ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  />
                  <p className="text-sm font-medium text-foreground">
                    {isDragging ? 'Release to upload' : 'Drop here or click to browse'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                ZIP · index.html required · {maxUploadSizeMB}MB max
              </p>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              {/* Developer & Agent Snippets */}
              <div className="mt-8 pt-6 border-t border-border/60">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Deploy via API & Agents
                  </span>
                  <Link
                    href="/dashboard"
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                  >
                    Get API Key <ArrowRight className="size-3" />
                  </Link>
                </div>

                <div className="rounded-xl border border-border bg-muted/40 p-1 text-left">
                  {/* Tab Selector */}
                  <div className="flex gap-1 border-b border-border/40 pb-1 mb-2 px-1">
                    {(['mcp', 'curl', 'js', 'python'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveSnippetTab(tab)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          activeSnippetTab === tab
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {tab === 'mcp' ? 'MCP Agent' : tab === 'curl' ? 'cURL' : tab === 'js' ? 'Node.js' : 'Python'}
                      </button>
                    ))}
                  </div>

                  {/* Code Display */}
                  <div className="relative group p-2">
                    <pre className="font-mono text-[11px] leading-relaxed text-foreground overflow-x-auto p-2 bg-background/60 rounded-lg border border-border/40">
                      <code>{snippets[activeSnippetTab]}</code>
                    </pre>
                    <button
                      onClick={() => copyToClipboard(snippets[activeSnippetTab], 'snippet')}
                      className="absolute top-4 right-4 rounded-md border border-border bg-background p-1.5 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground hover:bg-muted"
                      title="Copy snippet"
                    >
                      {copiedField === 'snippet' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Uploading */}
          {step === 'uploading' && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h1 className="text-4xl font-bold tracking-tight text-foreground">
                  Uploading…
                </h1>
                <p className="font-mono text-sm text-muted-foreground truncate">
                  {uploadingFileName}
                </p>
              </div>

              <div className="space-y-2">
                <div className="h-0.5 w-full rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full bg-foreground transition-all duration-150 ease-out rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right tabular-nums">
                  {progress}%
                </p>
              </div>
            </div>
          )}

          {/* Step 3 — Success */}
          {step === 'success' && uploadedProject && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {(() => {
                const fullUrl = `${window.location.origin}${uploadedProject.shareUrl}`;
                const removeUrl = `${window.location.origin}${uploadedProject.removeUrl}`;
                return (
                  <>
                    {/* Thumbnail preview */}
                    <div
                      ref={previewContainerRef}
                      className="relative w-full rounded-xl border border-border overflow-hidden bg-muted"
                      style={{ aspectRatio: '16/9' }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '900px',
                          height: '506.25px',
                          transform: `scale(${previewScale})`,
                          transformOrigin: 'top left',
                          pointerEvents: 'none',
                        }}
                      >
                        <iframe
                          src={fullUrl}
                          title="Project preview"
                          sandbox="allow-scripts"
                          style={{ width: '900px', height: '506.25px', border: 'none' }}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Share link
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={fullUrl}
                            className="flex-1 min-w-0 rounded-lg border border-border bg-muted px-3 py-2 text-xs font-mono text-foreground focus:outline-none"
                          />
                          <button
                            onClick={() => copyToClipboard(fullUrl, 'share')}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
                          >
                            {copiedField === 'share' ? <Check className="size-4" /> : <Copy className="size-4" />}
                            {copiedField === 'share' ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Removal link
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={removeUrl}
                            className="flex-1 min-w-0 rounded-lg border border-border bg-muted px-3 py-2 text-xs font-mono text-foreground focus:outline-none"
                          />
                          <button
                            onClick={() => copyToClipboard(removeUrl, 'remove')}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            {copiedField === 'remove' ? <Check className="size-4" /> : <Copy className="size-4" />}
                            {copiedField === 'remove' ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Secret token
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={uploadedProject.deleteToken}
                            className="flex-1 min-w-0 rounded-lg border border-border bg-muted px-3 py-2 text-xs font-mono text-foreground focus:outline-none"
                          />
                          <button
                            onClick={() => copyToClipboard(uploadedProject.deleteToken, 'token')}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            {copiedField === 'token' ? <Check className="size-4" /> : <Copy className="size-4" />}
                            {copiedField === 'token' ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Save the removal link or this token if you want to delete the project later.
                        </p>
                      </div>
                    </div>

                    {/* CTAs */}
                    <div className="flex items-center justify-between">
                      <a
                        href={uploadedProject.shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
                      >
                        Open project
                        <ArrowRight className="size-4" />
                      </a>
                      <button
                        onClick={reset}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Upload another
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Made with ♥ by{' '}
          <a
            href="https://github.com/yhauxell"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            @yhauxell
          </a>{' '}
          with some spare tokens
        </p>
      </footer>
    </div>
  );
}
