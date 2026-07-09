'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Check, Copy, AlertCircle, Loader } from 'lucide-react';
import { DEFAULT_MAX_FILE_UPLOAD_SIZE_BYTES } from '@/lib/upload-config';

interface UploadResponse {
  projectId: string;
  shareUrl: string;
  files: string[];
}

export default function Page() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedProject, setUploadedProject] = useState<UploadResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [maxUploadSizeBytes, setMaxUploadSizeBytes] = useState(DEFAULT_MAX_FILE_UPLOAD_SIZE_BYTES);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.maxFileUploadSize === 'number') {
          setMaxUploadSizeBytes(data.maxFileUploadSize);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch upload config, using default limit:', err);
      });
  }, []);

  const maxUploadSizeMB = maxUploadSizeBytes / (1024 * 1024);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
    // Validate file
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please upload a ZIP file');
      return;
    }

    if (file.size > maxUploadSizeBytes) {
      setError(`File size must be less than ${maxUploadSizeMB}MB`);
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadedProject(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      setUploadedProject(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to upload file'
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const copyToClipboard = async () => {
    if (!uploadedProject) return;

    const fullUrl = `${window.location.origin}${uploadedProject.shareUrl}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Share Your HTML
          </h1>
          <p className="text-lg text-muted-foreground">
            Upload a ZIP file with index.html and all your assets. Get a
            shareable link instantly.
          </p>
        </div>

        {/* Upload Zone */}
        {!uploadedProject ? (
          <div className="space-y-6">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative rounded-xl border-2 border-dashed p-12 text-center transition-all duration-200 cursor-pointer ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/50'
              } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="absolute inset-0 cursor-pointer opacity-0"
                disabled={isUploading}
              />

              <div className="flex flex-col items-center gap-3">
                {isUploading ? (
                  <>
                    <Loader className="size-10 text-primary animate-spin" />
                    <p className="text-sm font-medium text-foreground">
                      Processing your ZIP file...
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="size-10 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Drag and drop your ZIP file here
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        or click to select a file
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Requirements */}
            <div className="rounded-lg bg-card border border-border p-4">
              <p className="text-xs font-semibold text-foreground uppercase mb-3">
                Requirements
              </p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>ZIP file containing index.html as the main entry point</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>All CSS, JavaScript, and asset files included</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Maximum file size: {maxUploadSizeMB}MB</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Private link - only those with the URL can access</span>
                </li>
              </ul>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 flex gap-3">
                <AlertCircle className="size-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Error</p>
                  <p className="text-sm text-destructive/80">{error}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Success State */
          <div className="space-y-6 animate-in fade-in-50 duration-300">
            <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-8 text-center">
              <Check className="size-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Upload Successful!
              </h2>
              <p className="text-muted-foreground">
                Your project is now live and ready to share
              </p>
            </div>

            {/* Share Link */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Your shareable link:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}${uploadedProject.shareUrl}`}
                  className="flex-1 rounded-lg bg-card border border-border px-4 py-3 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Copy className="size-4" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Project Details */}
            <div className="rounded-lg bg-card border border-border p-6">
              <p className="text-sm font-semibold text-foreground uppercase mb-4">
                Project Details
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Project ID:</span>
                  <span className="font-mono text-foreground">
                    {uploadedProject.projectId.slice(0, 16)}...
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Files uploaded:</span>
                  <span className="font-medium text-foreground">
                    {uploadedProject.files.length}
                  </span>
                </div>
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    File List
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {uploadedProject.files.slice(0, 10).map((file) => (
                      <p
                        key={file}
                        className="text-xs font-mono text-muted-foreground truncate"
                      >
                        {file}
                      </p>
                    ))}
                    {uploadedProject.files.length > 10 && (
                      <p className="text-xs text-muted-foreground">
                        +{uploadedProject.files.length - 10} more files
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <a
                href={uploadedProject.shareUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded-lg bg-primary text-primary-foreground px-4 py-3 text-center font-medium hover:opacity-90 transition-opacity"
              >
                View Project
              </a>
              <button
                onClick={() => {
                  setUploadedProject(null);
                  setError(null);
                }}
                className="flex-1 rounded-lg bg-secondary text-secondary-foreground px-4 py-3 text-center font-medium hover:opacity-90 transition-opacity"
              >
                Upload Another
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
