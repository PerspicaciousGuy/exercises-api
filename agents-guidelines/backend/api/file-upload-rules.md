# API File Upload Rules

<!-- meta
target: API guidance
last_reviewed: 2026-07
sources: inherited from retired agent-api-rules.md
extends: AGENTS.md
-->

> Rules for API file upload validation, limits, storage, and resumable upload handling.

---

## API File Uploads

These apply when the API handles file uploads.

### Validation
- Whitelist allowed file extensions and MIME types — reject everything else
- Validate the file's actual content (magic bytes) — never trust the client-provided `Content-Type` or extension
- Scan uploaded files for malware when handling user-generated content — discuss with the user before skipping
- Sanitize filenames — never use the user-provided filename for storage; generate a unique name (UUID) on the server

### Size Limits
- Enforce file size limits at the server/proxy level (e.g. Nginx `client_max_body_size`) and at the application level
- Define maximum file size as a named constant — never a magic number
- Return `413 Payload Too Large` when the limit is exceeded

### Storage
- Never store uploaded files in the application directory or anywhere accessible via the web server
- Prefer managed object storage (S3, GCS, Azure Blob) over the local filesystem for production
- For large files, use presigned upload URLs so the client uploads directly to storage — not through the API server
- Implement a cleanup policy for orphaned or incomplete uploads

### Chunked & Resumable Uploads
- For files larger than a defined threshold, support chunked or resumable uploads — discuss the threshold with the user
- Never load an entire large file into memory — use streaming

---