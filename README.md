# MP3 Frame Counter API

A small Node/TypeScript API that accepts an MP3 file upload and returns the number of MPEG-1 Layer III audio frames it contains.

It:

- Validates MPEG-1 Layer III headers
- Walks frame-by-frame for performance
- Detects and ignores a VBR header frame (`Xing` / `Info`) so counts align with tools like MediaInfo

---

## Tech Stack

- **Node.js** + **Express**
- **TypeScript**
- **Multer** for file uploads (in-memory)
- **Jest** for testing
- **ESLint** + **Prettier** for linting/formatting

---

## Getting Started

### Prerequisites

- Node.js **v18+** recommended
- npm (bundled with Node)

### Install dependencies

```bash
npm install
```

# Start dev server with reload

```bash
npm run dev
```

# Type-check

```bash
npm run build
```

# Lint source files

```bash
npm run lint
```

# Lint and auto-fix where possible

```bash
npm run lint:fix
```

# Format with Prettier

```bash
npm run format
```

# Run tests

```bash
npm test
```

## Note:

To execute. Start the api with npm run dev.

Use postman or curl to to hit the local endpoint file-upload.
A sample mp3 has been provided in the repo to test.

## Postman

- Post http://localhost:3000/file-upload
- form-data key (file) value (sample.mp3)

## Curl

- curl -X POST -F "file=@./sample.mp3" http://localhost:3000/file-upload

Code Coverage - Lines 101 and 154 are uncovered as they are not realistically reachable
for MP3 data and are a safety guard for corrupted/fake input.

If this were a larger project I would put helper functions/types into their own files.
The structure of the project would also align with self-containted modules.

- Ex. src/server.ts
- Ex. src/modules/frame-counter/services/frame-counter.service.ts
- Ex. src/modules/frame-counter/services/frame-counter.helpers.ts
- Ex. src/modules/frame-counter/services/frame-counter.types.ts
