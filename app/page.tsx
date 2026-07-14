'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Copy, Check, Star, Sun, Moon, ArrowRight } from 'lucide-react';
import { DEFAULT_MAX_FILE_UPLOAD_SIZE_BYTES } from '@/lib/upload-config';

type Step = 'idle' | 'uploading' | 'success';

interface UploadResponse {
  projectId: string;
  shareUrl: string;
  files: string[];
}

export default function Page() {
  const [step, setStep] = useState<Step>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [uploadedProject, setUploadedProject] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [maxUploadSizeBytes, setMaxUploadSizeBytes] = useState(DEFAULT_MAX_FILE_UPLOAD_SIZE_BYTES);
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
    xhr.send(formData);
  };

  const copyToClipboard = async () => {
    if (!uploadedProject) return;
    const fullUrl = `${window.location.origin}${uploadedProject.shareUrl}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setStep('idle');
    setUploadedProject(null);
    setError(null);
    setProgress(0);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col">
      {/* Top-right controls */}
      <div className="fixed top-4 right-4 flex items-center gap-2 z-10">
        <a
          href="https://github.com/yhauxell/static-website-uploader"
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

                    {/* Share URL */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={fullUrl}
                        className="flex-1 min-w-0 rounded-lg border border-border bg-muted px-3 py-2 text-xs font-mono text-foreground focus:outline-none"
                      />
                      <button
                        onClick={copyToClipboard}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-3 py-2 text-sm font-medium hover:opacity-80 transition-opacity shrink-0"
                      >
                        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>

                    {/* CTAs */}
                    <div className="flex items-center justify-between">
                      <a
                        href={uploadedProject.shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-80 transition-opacity"
                      >
                        Open project
                        <ArrowRight className="size-4" />
                      </a>
                      <button
                        onClick={reset}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
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
