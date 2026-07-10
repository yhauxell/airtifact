# static-website-uploader

Upload a ZIP file containing a static website and instantly get a private share link.

## Live Demo

🔗 https://staticmarkup.vercel.app/

## Features

- Drag-and-drop ZIP upload UI
- Project links using secure random IDs
- Static asset hosting through Vercel Blob
- Password-protected admin dashboard for project management

## Tech Stack

- Next.js
- TypeScript
- Vercel Blob

## Getting Started

### 1) Clone the repository

```bash
git clone https://github.com/yhauxell/static-website-uploader.git
cd static-website-uploader
```

### 2) Install dependencies

```bash
npm install
```

### 3) Configure environment variables

Create a `.env.local` file and set:

```bash
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
MANAGE_PASSWORD=your_admin_password
# Optional, in bytes. Defaults to 5MB when unset.
MAX_FILE_UPLOAD_SIZE=5242880
```

### 4) Run the development server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Build for Production

```bash
npm run build
npm run start
```

## Deployment & Setup

For full deployment details, architecture notes, and troubleshooting, see:

- [SETUP.md](SETUP.md)

## Contributing

Contributions are welcome. Please keep pull requests focused and include a clear description of changes.

## License

MIT — see [LICENSE](LICENSE).