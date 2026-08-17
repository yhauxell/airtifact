# static-website-uploader

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyhauxell%2Fstatic-website-uploader)

Upload a ZIP file containing a static website and instantly get a private share link.

## Live Demo

🔗 https://staticmarkup.vercel.app/

## Features

- Drag-and-drop ZIP upload UI
- Project links using secure random IDs
- Static asset hosting through Vercel Blob
- Password-protected admin dashboard for project management
- Self-service project removal with a secret delete link and token

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
SESSION_SECRET=your_session_secret
ADMIN_PASSWORD_HASH=your_secure_password_hash
# Optional, in bytes. Defaults to 5MB when unset.
MAX_ANON_UPLOAD_SIZE_BYTES=5242880
MAX_AUTH_UPLOAD_SIZE_BYTES=52428800
```

#### Generating Admin Hash & Session Secret

Run the helper script to generate `ADMIN_PASSWORD_HASH` and `SESSION_SECRET`:

```bash
node apps/web/generate-hash.js <your_admin_password>
```

#### Admin Password Hash Calculation

- **Algorithm**: Key derivation via Node.js `crypto.scryptSync`.
- **Salt**: 16 random bytes formatted as a hexadecimal string (`crypto.randomBytes(16).toString('hex')`).
- **Scrypt Parameters**:
  - Cost factor ($N$): `16384`
  - Block size ($r$): `8`
  - Parallelization ($p$): `1`
  - Derived key length: 64 bytes
- **Hash Format**: `${salt}:${derivedKey.toString('hex')}` stored in `ADMIN_PASSWORD_HASH`.
- **Verification**: On authentication, the salt is extracted from the hash, `scryptSync` computes the derived key from the provided password, and constant-time comparison (`crypto.timingSafeEqual`) checks it against the stored key.

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