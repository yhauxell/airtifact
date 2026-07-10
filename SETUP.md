# ZIP HTML Uploader - Setup & Deployment Guide

A super simple Next.js app that lets you upload ZIP files containing HTML sites and share them via private URLs.

## Features

✅ **Drag-and-drop ZIP upload** - Beautiful UI with shadcn styling  
✅ **Cryptographically secure private IDs** - Random 32-char hex IDs (impossible to guess)  
✅ **Vercel Blob storage** - Files stored as public blobs, accessible via project page or API  
✅ **Shareable links** - Get instant URLs to share with anyone  
✅ **Admin dashboard** - Password-protected `/admin` route lists and removes projects  
✅ **Asset serving** - CSS, JS, images, fonts all properly served with correct MIME types  
✅ **iframe rendering** - Projects displayed in isolated iframe with proper base URL handling

## Architecture

### File Storage: Vercel Blob
- Files stored with `access: 'public'` — directly accessible via their Vercel Blob CDN URL
- Path structure: `projects/{projectId}/{filename}`
- Project metadata stored in `projects/{projectId}/metadata.json`
- Files are also served via API route `/api/projects/[projectId]/[...path]`
- **Note:** Project confidentiality relies on the secrecy of the 32-character project ID. Anyone who knows the CDN URL of a file can access it directly without going through the app.

### Project IDs
- Generated using `crypto.randomBytes(16).toString('hex')` → 32-character hex strings
- Cryptographically secure, impossible to brute force
- Not sequential or predictable

### Serving Architecture
```
User → /{projectId} (Next.js page) → Fetches /index.html from Blob → Renders in iframe
                                    ↓
                         <iframe src="..." base href="/{projectId}/">
                         Assets load via /api/projects/{projectId}/{asset} → Blob
```

## Setup for Deployment

### 1. Connect Vercel Blob Integration

1. Go to your Vercel project settings
2. Add the Blob integration (if not already added)
3. The integration automatically creates `BLOB_READ_WRITE_TOKEN` environment variable

### 2. Deploy to Vercel

The app is ready to deploy:

```bash
# Deploy via Vercel CLI
vercel deploy

# Or connect your Git repo and deploy via Vercel dashboard
```

### 3. Verify Deployment

Once deployed:
- Visit your domain → Landing page with drag-and-drop upload
- Click upload or drag a ZIP file → Get a shareable link
- Visit the link → See your HTML rendered
- Visit `/admin` → Admin dashboard showing all projects

## Local Testing

### Development Setup

```bash
# Install dependencies (already done)
pnpm install

# Start dev server
pnpm dev

# Navigate to http://localhost:3000
```

**Note:** Local development requires `BLOB_READ_WRITE_TOKEN` to be set if you want to test uploads. Without it, the app gracefully falls back to showing "No projects" on the admin page.

### Create Test ZIP

```python
python3 << 'EOF'
import zipfile
import os

# Create test directory and files
os.makedirs('test-project', exist_ok=True)

with open('test-project/index.html', 'w') as f:
    f.write('''<!DOCTYPE html>
<html>
<head>
    <title>Test</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Hello World!</h1>
    <script src="script.js"></script>
</body>
</html>''')

with open('test-project/style.css', 'w') as f:
    f.write('h1 { color: blue; }')

with open('test-project/script.js', 'w') as f:
    f.write('console.log("Hello!");')

# Create ZIP
with zipfile.ZipFile('test.zip', 'w') as z:
    z.write('test-project/index.html', 'index.html')
    z.write('test-project/style.css', 'style.css')
    z.write('test-project/script.js', 'script.js')

print("Created test.zip")
EOF
```

Then upload via the UI at `http://localhost:3000`

## File Structure

```
app/
├── page.tsx                              # Landing page with upload UI
├── admin/
│   └── page.tsx                          # Password-protected admin dashboard
├── [projectId]/
│   └── page.tsx                          # Project display (renders HTML)
├── api/
│   ├── upload/route.ts                   # Handle ZIP uploads
│   ├── admin/
│   │   ├── auth/route.ts                 # Admin password verification
│   │   └── projects/
│   │       ├── route.ts                  # List all projects (admin API)
│   │       └── [projectId]/route.ts      # Delete a project by ID
│   └── projects/
│       └── [projectId]/
│           └── [...path]/route.ts        # Serve files from Blob
├── layout.tsx                            # Root layout
├── globals.css                           # Tailwind + design tokens
```

## API Endpoints

### `POST /api/upload`
Upload a ZIP file

**Request:**
```
multipart/form-data
- file: File (must be .zip)
```

**Response:**
```json
{
  "projectId": "a1b2c3d4e5f6...",
  "shareUrl": "/a1b2c3d4e5f6...",
  "files": ["index.html", "style.css", "script.js"],
  "metadata": {
    "projectId": "...",
    "uploadDate": "2025-06-11T...",
    "fileName": "project.zip",
    "fileCount": 3,
    "files": [...]
  }
}
```

### `GET /api/projects/[projectId]/[...path]`
Fetch a file from a project

**Example:** `/api/projects/a1b2c3d4e5f6/style.css` → CSS file with correct headers

### `GET /api/admin/projects`
List all projects (called by `/admin`, requires `x-manage-password`)

**Response:**
```json
{
  "projects": [
    {
      "projectId": "...",
      "uploadDate": "2025-06-11T...",
      "fileName": "my-site.zip",
      "fileCount": 15,
      "files": ["index.html", ...]
    }
  ]
}
```

### `POST /api/admin/auth`
Validate dashboard password (BotID protected)

**Request:**
```json
{
  "password": "your-manage-password"
}
```

### `DELETE /api/admin/projects/[projectId]`
Remove a project and all files (requires `x-manage-password`, BotID protected)

## Security

### Privacy
- Project IDs are cryptographically random (32 hex chars)
- Files stored as `public` in Vercel Blob — treat project IDs as secrets since anyone with a direct CDN URL can access files
- No directory listing exposed through the app — only valid project IDs can be accessed via the UI
- **Security through unpredictability** — no one can guess your project ID

### Admin Authentication
- `/admin` is password protected
- Password checks are server-side and matched against `MANAGE_PASSWORD`
- There is no default fallback password
- Vercel BotID protects admin authentication and project deletion requests

## Limitations & Considerations

### File Size
- Max file size is configurable via `MAX_FILE_UPLOAD_SIZE` (bytes)
- Default limit is 5MB when `MAX_FILE_UPLOAD_SIZE` is not set
- Limit is enforced client-side and server-side
- Vercel Blob has generous limits for free tier

### Simultaneous Uploads
- Each upload creates one project
- Uploads are sequential (browser limitation)
- Server can handle multiple concurrent uploads

### Index.html Detection
- Must be exactly `index.html` (case-insensitive)
- Must be in ZIP root directory (not in subdirectories)
- Other files can be in nested folders

### Asset Path Handling
- URLs in CSS/JS should be relative (e.g., `./style.css`, not `/style.css`)
- Absolute paths `/image.png` will fail
- The iframe has `base href="/{projectId}/"` to handle most relative URLs

## Customization

### Change Admin Route
Default route is `/admin`, but you can change it:

```bash
# Rename the folder
mv app/admin app/super-secret-admin

# Update any links
# Update this document
```

### Project Deletion
- Admin dashboard includes project deletion
- Confirmation requires entering the exact project ID
- Endpoint: `DELETE /api/admin/projects/[projectId]`

### Add View Counter
In `app/[projectId]/page.tsx`, increment a counter:

```typescript
await put(
  `projects/${projectId}/views.json`,
  JSON.stringify({ views: (views || 0) + 1 })
);
```

### Add Download
Add a download link in the project page or admin dashboard.

## Troubleshooting

### "Failed to fetch projects" on admin page
- Check that `BLOB_READ_WRITE_TOKEN` is set in environment variables
- In development, this is expected without the token set
- On Vercel, the integration automatically provides the token

### Upload fails with "File must be a ZIP archive"
- Make sure the file is actually a `.zip` file, not `.tar.gz` or `.rar`
- Check that MIME type is correct

### Assets not loading in rendered project
- Make sure all files are in the ZIP root directory or have correct relative paths
- Check browser console for 404 errors
- Verify file names match in HTML (case-sensitive)

### Blob API errors in production
- Ensure Blob integration is added to Vercel project
- Check that `BLOB_READ_WRITE_TOKEN` environment variable exists
- Verify project has Blob access enabled

## Cost on Vercel Free Plan

- **Blob storage:** 1GB free, $0.50/GB additional
- **Serverless functions:** 100GB hours free/month
- **Bandwidth:** Included in Vercel free tier

This app is extremely cheap to run - mostly just blob storage for user uploads.

## Next Steps

1. **Deploy to Vercel** - Click "Publish" button in v0 UI
2. **Test uploads** - Try uploading a ZIP file from the landing page
3. **Check admin** - Visit `/admin` to see the project listed
4. **Share links** - Copy the project link and share with anyone

---

Built with Next.js 16, Vercel Blob, and shadcn/ui. Happy sharing! 🚀
