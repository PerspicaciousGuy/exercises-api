# Security Guidelines

<!-- meta
target: language-agnostic
last_reviewed: 2026-06
sources: owasp.org/Top10/2021, cheatsheetseries.owasp.org
extends: none
-->

> Language-agnostic security rules. Apply these to every project regardless of stack or framework. These rules address the OWASP Top 10:2021 and common security failures in web applications and APIs. Authentication implementation rules are covered in `auth-rules.md`. Framework-specific security middleware is covered in the relevant framework files.
>
> Every rule in this file traces back to the OWASP Top 10:2021 or the OWASP Cheat Sheet Series. Source references are included per section.

---

## Table of Contents

1. [Security Mindset](#1-security-mindset)
2. [Input Validation](#2-input-validation)
3. [Injection Attacks](#3-injection-attacks)
4. [Cross-Site Scripting (XSS)](#4-cross-site-scripting-xss)
5. [Cross-Site Request Forgery (CSRF)](#5-cross-site-request-forgery-csrf)
6. [Broken Access Control](#6-broken-access-control)
7. [Sensitive Data Exposure](#7-sensitive-data-exposure)
8. [Security Headers](#8-security-headers)
9. [Dependency Security](#9-dependency-security)
10. [Rate Limiting and Denial of Service](#10-rate-limiting-and-denial-of-service)
11. [File Uploads](#11-file-uploads)
12. [Security Logging](#12-security-logging)
13. [Server-Side Request Forgery (SSRF)](#13-server-side-request-forgery-ssrf)
14. [Anti-Patterns](#14-anti-patterns)

---

## 1. Security Mindset

Source: `owasp.org/Top10/2021/A00_2021-Introduction`

These principles apply to every decision in every section.

### Treat all external input as untrusted

Every value that enters the system from outside the process is untrusted until validated. This includes:

- HTTP request bodies, query strings, headers, cookies, route params
- Data from external APIs and third-party services
- Data read from files uploaded by users
- Data from environment variables (validated at startup — see `node-rules.md` / `python-rules.md`)
- Data from databases when the original source was user input

Never assume data is safe because it came from your own database. If the original source was user input, validate it again at every trust boundary.

### Defence in depth

Never rely on a single layer of security. Apply controls at multiple levels:

- Validate input at the boundary (schema validation)
- Use parameterised queries (injection prevention)
- Encode output (XSS prevention)
- Enforce access control checks in every handler (broken access control prevention)
- Apply security headers (browser-level protection)

Failing any one layer should not expose the system. Layers compensate for each other.

### Principle of least privilege

- Every component gets the minimum access it needs — nothing more
- Database users only have the permissions required for the application's queries
- API keys and service accounts are scoped to only the operations they need
- Users can only access their own data unless explicitly granted broader access

### Fail securely

When an error occurs, the system must fail into a safe state — not an open one.

- On auth failure: deny access, do not expose why the check failed
- On input validation failure: reject the request, do not process partial data
- On unexpected errors: return a generic message, do not expose internals

---

## 2. Input Validation

Source: `cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html`
Related OWASP Top 10: A03 Injection, A04 Insecure Design

### Allowlist, not denylist

Validate that input matches what is expected (allowlist), not that it does not match known bad patterns (denylist). Denylist approaches always have gaps.

```
# ✅ Allowlist — define exactly what is valid
email: must match RFC 5322 format, max 254 characters
age: integer, 0-150
role: must be one of ['admin', 'user', 'guest']
filename: alphanumeric, hyphens, underscores, one dot — no slashes

# ❌ Denylist — trying to block known bad patterns
reject if contains: <, >, ', ", ;, --
# These are always incomplete and can be bypassed
```

### Validate server-side always

Client-side validation is a UX feature, not a security feature. Any attacker can bypass it. Always validate on the server regardless of what the client does.

### Validate at the boundary

Validate as early as possible — at the point data enters the system. Do not pass raw unvalidated input through multiple layers before checking it.

### What to validate on every input

- **Type** — is the value the expected type (string, number, boolean)?
- **Format** — does it match the expected pattern (UUID, email, date)?
- **Length** — is it within min/max length bounds?
- **Range** — for numbers, is the value within acceptable range?
- **Allowed values** — for enums and categorical values, is it one of the allowed options?

### File upload validation

- Validate file extension against an allowlist of accepted extensions
- Validate MIME type server-side — do not trust the `Content-Type` header sent by the client
- Enforce a maximum file size
- Never use the original filename from the client for storage — generate a UUID-based name
- Never store uploaded files in a publicly accessible path unless the file is meant to be public
- Never serve uploaded files from the same origin as the application

---

## 3. Injection Attacks

Source: `owasp.org/Top10/2021/A03_2021-Injection`
OWASP Top 10: **A03:2021 — #3 most critical**

Injection occurs when untrusted data is sent to an interpreter as part of a command or query. SQL injection, command injection, and code injection are the most common forms.

### SQL injection

Never construct SQL queries by concatenating user input. Always use parameterised queries or an ORM.

```
# ❌ Vulnerable — direct string interpolation
query = f"SELECT * FROM users WHERE email = '{user_email}'"
db.execute(query)

# ✅ Safe — parameterised query
db.execute("SELECT * FROM users WHERE email = ?", (user_email,))

# ✅ Safe — ORM (Prisma, SQLAlchemy, etc.)
user = await db.user.findUnique({ where: { email: userEmail } })
```

If raw queries are unavoidable:
- Use the database driver's parameterisation API — never string format
- Use `$queryRaw` with tagged template literals (Prisma), never `$queryRawUnsafe` with user input
- Whitelist any dynamic structural elements (table names, column names) against a known-good list

### Command injection

Never pass user input to shell commands.

```
# ❌ Vulnerable
subprocess.run(f"convert {user_filename} output.png", shell=True)

# ✅ Safe — no shell, arguments as list
subprocess.run(["convert", safe_filename, "output.png"], shell=False)
```

- Never use `shell=True` (Python) or `{ shell: true }` (Node.js) with user-supplied input
- Use `shlex.quote` (Python) or `shell-escape` if shell invocation is truly unavoidable
- Whitelist filenames and paths — never pass user-provided values directly

### Code injection

- Never use `eval()`, `exec()`, `Function()`, or dynamic code execution on user input
- Never deserialise untrusted data with `pickle` (Python), `unserialize` (PHP), or equivalent
- Never use `__import__` or dynamic module loading with user-controlled names

### NoSQL injection

NoSQL databases are also vulnerable. Never pass user-controlled objects directly into query filters.

```
# ❌ Vulnerable — user can pass { "$gt": "" } as the password field
db.users.find({ email: body.email, password: body.password })

# ✅ Safe — validate and type-check before querying
const input = LoginSchema.parse(body) # throws on invalid
db.users.find({ email: input.email, password: input.password })
```

---

## 4. Cross-Site Scripting (XSS)

Source: `cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html`
Related OWASP Top 10: A03 Injection

XSS occurs when untrusted data is rendered in a browser without proper encoding, allowing attackers to execute scripts in the victim's browser.

### Output encoding

Encode all user-controlled data before inserting it into HTML. The encoding method depends on the context:

| Context | Encoding required |
|---|---|
| HTML body content | HTML entity encoding (`&lt;`, `&gt;`, `&amp;`, `&quot;`) |
| HTML attribute value | HTML attribute encoding |
| JavaScript variable | JavaScript string encoding |
| CSS value | CSS hex encoding |
| URL parameter | URL percent encoding |

### Framework auto-escaping

Modern frameworks handle most output encoding automatically:
- React: JSX expressions `{value}` are auto-escaped. `dangerouslySetInnerHTML` bypasses this — never use it with untrusted data.
- Next.js: Same as React.
- Jinja2/Django templates: auto-escaped by default. `| safe` filter bypasses this — never use it with untrusted data.

**Never use escape hatches with untrusted data.** These include:
- `dangerouslySetInnerHTML` (React)
- `innerHTML` (DOM API)
- `v-html` (Vue)
- `[innerHTML]` (Angular)
- `| safe` (Jinja2)
- `{{{ }}}` (Handlebars)

### When user HTML is required

If the application must render user-provided HTML (e.g. rich text editors), sanitise with a dedicated library — never write a custom sanitiser.

- **JavaScript**: `DOMPurify` — use `DOMPurify.sanitize(userHtml)` before setting `innerHTML`
- **Python**: `bleach` — use `bleach.clean(userHtml, allowed_tags=[...])` with an explicit allowlist

### Content Security Policy (CSP)

Set a strict `Content-Security-Policy` header. This limits what browsers can execute even if XSS occurs.

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'
```

Rules:
- Never use `unsafe-inline` or `unsafe-eval` in production CSP — they defeat the policy
- Use CSP nonces for inline scripts if inline scripts are required
- Test CSP in report-only mode before enforcing

---

## 5. Cross-Site Request Forgery (CSRF)

Source: `cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html`
Related OWASP Top 10: A01 Broken Access Control

CSRF tricks an authenticated user's browser into making an unwanted request to your application.

### When CSRF protection is needed

CSRF applies to cookie-based authentication only. If your API exclusively uses `Authorization: Bearer` tokens (not cookies), CSRF is not applicable — browsers do not automatically attach custom headers cross-origin.

If you use cookies for session management: CSRF protection is mandatory.

### Primary defence — SameSite cookie attribute

Set `SameSite=Strict` or `SameSite=Lax` on all session cookies.

```
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Strict
```

- `SameSite=Strict` — cookie is never sent on cross-site requests. Most secure.
- `SameSite=Lax` — cookie is sent on top-level navigations (clicking a link) but not on embedded requests. Good default.
- `SameSite=None` — cookie is sent on all cross-site requests. Requires `Secure`. Only use when cross-site cookie sharing is a business requirement.

### Secondary defence — CSRF tokens (for forms)

For applications using traditional form submission with cookies, use the Synchroniser Token Pattern:
- Generate a cryptographically random token per session
- Include the token in every state-changing form as a hidden field
- Validate the token server-side on every state-changing request

### Secondary defence — custom request headers (for APIs)

For APIs that must support cross-origin requests with cookies, require a custom header on all state-changing requests (e.g. `X-Requested-With: XMLHttpRequest`). Browsers cannot set custom headers cross-origin without a CORS preflight, which the server can reject.

### Rules

- Never rely on `Referer` header validation as the sole CSRF defence — it can be suppressed
- Never set `SameSite=None` without an explicit business requirement
- Always combine `SameSite` with `HttpOnly` and `Secure` on session cookies

---

## 6. Broken Access Control

Source: `owasp.org/Top10/2021/A01_2021-Broken_Access_Control`
OWASP Top 10: **A01:2021 — #1 most critical**

Access control enforces that users can only perform actions and access data they are allowed to. Broken access control means those checks are missing or bypassable.

### Check on every request

Never assume a user has access because they have a valid session token. Verify authorisation explicitly on every request that accesses protected data or performs a protected action.

```
# ❌ Missing ownership check — user can access any post
async def get_post(post_id: str, user: User):
    return await db.post.findUnique(where={ "id": post_id })

# ✅ Ownership check enforced
async def get_post(post_id: str, user: User):
    post = await db.post.findUnique(where={ "id": post_id })
    if not post:
        raise NotFoundError("Post")
    if post.userId != user.id:
        raise ForbiddenError("Access denied")
    return post
```

### Deny by default

Default to denying access. Only grant access when an explicit permission check passes. Never grant access because a check was not performed.

### Horizontal vs vertical access control

- **Vertical**: User can only perform actions their role allows (admin vs user)
- **Horizontal**: User can only access their own data, not another user's data

Both must be checked. A non-admin user with valid auth must not be able to access another user's data even if the route is not role-restricted.

### Direct object reference

Never expose internal IDs that allow users to enumerate or access other users' resources. Always verify ownership, not just validity.

```
# ❌ Insecure direct object reference
GET /invoices/1234
# Any authenticated user can increment the ID and access others' invoices

# ✅ Always verify the resource belongs to the requesting user
const invoice = await db.invoice.findUnique({ where: { id, userId: requestingUser.id } })
if (!invoice) throw new NotFoundError('Invoice') // same error for not found and forbidden — no info leak
```

Return `404 Not Found` (not `403 Forbidden`) when a user tries to access a resource they do not own. This prevents leaking the existence of the resource.

### Rules

- Never perform access control checks only on the frontend — always enforce server-side
- Never trust user-supplied role or permission values from the request body or query string
- Centralise access control logic — do not scatter ownership checks across service methods
- Log every access control failure — they are signals of attempted attacks

---

## 7. Sensitive Data Exposure

Source: `owasp.org/Top10/2021/A02_2021-Cryptographic_Failures`
OWASP Top 10: A02:2021

### Never expose in API responses

- Password hashes — never return them in any API response
- Internal IDs used for enumeration
- Full credit card numbers, CVV codes
- Social security numbers or national ID numbers
- Private keys, tokens, secrets
- Internal stack traces, database errors, file paths

### Never store in plaintext

- Passwords — always hash with bcrypt, scrypt, or Argon2. Never MD5 or SHA-1 for passwords.
- Payment card data — never store unless PCI-DSS certified
- Tokens and secrets — encrypt at rest

### Never log

- Passwords (including failed login attempts)
- Session tokens, JWT tokens, API keys
- Full credit card numbers
- PII beyond what is operationally required
- Request bodies that may contain any of the above

### Transport security

- Always use HTTPS in production — never HTTP
- Set `Strict-Transport-Security` header (HSTS) to enforce HTTPS at the browser level
- Never send sensitive data in URL query parameters — they appear in server logs and browser history

```
# ❌ Token in URL — logged everywhere
GET /api/reset-password?token=abc123

# ✅ Token in body or header
POST /api/reset-password
Body: { "token": "abc123", "newPassword": "..." }
```

### Cryptography

- Use strong, modern algorithms: AES-256 for encryption, SHA-256 or better for hashing, bcrypt/Argon2 for passwords
- Never implement your own cryptography — use the standard library or a well-vetted library
- Never use MD5 or SHA-1 for security purposes — only for non-security checksums
- Always use cryptographically secure random number generators for tokens and secrets:
  - Node.js: `crypto.randomBytes()`
  - Python: `secrets.token_hex()`
  - Never: `Math.random()`, `random.random()`

---

## 8. Security Headers

Source: `cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html`
Related OWASP Top 10: A05 Security Misconfiguration

Set these headers on every HTTP response. Use `helmet` (Express/Fastify) or equivalent middleware.

### Required headers

```
# Prevent browsers from guessing content type
X-Content-Type-Options: nosniff

# Prevent clickjacking
X-Frame-Options: DENY

# Enforce HTTPS (only on HTTPS responses)
Strict-Transport-Security: max-age=31536000; includeSubDomains

# Control referrer information
Referrer-Policy: strict-origin-when-cross-origin

# Restrict browser features
Permissions-Policy: camera=(), microphone=(), geolocation=()

# Content Security Policy (application-specific)
Content-Security-Policy: default-src 'self'
```

### Remove identifying headers

Remove headers that expose implementation details to attackers:

```
# Remove these headers
X-Powered-By: Express       # tells attackers you're using Express
Server: nginx/1.18.0        # tells attackers your server version
```

`helmet()` in Express/Fastify removes `X-Powered-By` automatically. Configure your web server to suppress the `Server` header.

### CORS configuration

Source: `cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html`

- Never set `Access-Control-Allow-Origin: *` on endpoints that return authenticated or sensitive data
- Always use an explicit allowlist of origins
- Never reflect the `Origin` header value directly back without validating it against the allowlist
- `Access-Control-Allow-Credentials: true` must never be paired with `Access-Control-Allow-Origin: *`

```
# ❌ Allows any origin to make credentialed requests
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true

# ✅ Explicit allowlist
Access-Control-Allow-Origin: https://app.yourdomain.com
Access-Control-Allow-Credentials: true
```

---

## 9. Dependency Security

Source: `owasp.org/Top10/2021/A06_2021-Vulnerable_and_Outdated_Components`
OWASP Top 10: A06:2021

### Rules

- Run dependency audits in CI on every build. Block deployment on high-severity vulnerabilities.
  - Node.js: `npm audit` or `yarn audit`
  - Python: `uv audit` or `pip-audit`

- Pin exact dependency versions in production to prevent unexpected upgrades pulling in malicious or broken code.

- Use lockfiles (`package-lock.json`, `uv.lock`) and commit them. Never deploy without a lockfile.

- Review every new dependency before adding it. Check:
  - Is it actively maintained? (last commit, open issues)
  - How many weekly downloads? (larger = more scrutinised)
  - Is the publisher trustworthy?
  - Do you actually need it, or can the native language/runtime do this?

- Subscribe to security advisories for your major dependencies (GitHub Dependabot, `npm audit` RSS, PyPI security advisories).

- Remove unused dependencies — they are attack surface with no benefit.

- Never install packages from unofficial sources. Always use the official registry (`npmjs.com`, `pypi.org`).

- Watch for typosquatting — packages named similarly to popular packages. Verify the exact package name before installing.

---

## 10. Rate Limiting and Denial of Service

Source: `cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html`

### Rate limiting

Apply rate limiting at multiple levels:

| Level | What to limit | Default |
|---|---|---|
| Global | All requests per IP | 100 req / 15 min |
| Auth endpoints | Login, register, password reset | 10 req / 15 min |
| Sensitive endpoints | Password change, email change, 2FA | 5 req / 15 min |
| Resource-intensive | Report generation, bulk export | 5 req / hour |

Rules:
- Always return `429 Too Many Requests` with a `Retry-After` header when the limit is exceeded
- Rate limit by IP for unauthenticated requests, by user ID for authenticated requests
- Apply stricter limits to auth endpoints — brute force attacks specifically target these
- Rate limiting belongs at the infrastructure level (reverse proxy, API gateway) for production. Application-level rate limiting (`express-rate-limit`, `@fastify/rate-limit`) is a secondary defence.

### Payload size limits

Always limit request body size. Never accept arbitrarily large payloads.

```
# ✅ Explicit payload limits
express.json({ limit: '10kb' })      # Express
app.setBodyLimit(10 * 1024)          # Fastify
```

### Resource limits

- Always paginate database queries — never return unbounded collections (see `rest-api-rules.md`)
- Apply timeouts to all external calls — never wait indefinitely
- Abort long-running operations instead of holding connections

---

## 11. File Uploads

Source: `cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html`

File upload is one of the highest-risk features in a web application. Every rule below is mandatory when implementing file upload.

### Validation

- Validate file extension against an explicit allowlist. Never a denylist.
- Validate MIME type server-side by inspecting the file's magic bytes — not the `Content-Type` header.
- Enforce a maximum file size before processing the file.
- Scan uploaded files with an antivirus or sandbox API if the files will be served to other users.

### Storage

- Never store uploaded files in the web root or any publicly accessible directory.
- Never serve uploaded files from the same origin as the application. Use a separate domain or CDN (e.g. `uploads.yourdomain.com` or cloud storage).
- Generate a UUID-based filename for every uploaded file. Never use the original filename for storage.
- Never allow uploaded filenames to contain path separators (`/`, `\`, `..`).

### Processing

- Never execute or serve uploaded files as code — validate that uploaded files are data, not scripts.
- Run image processing (resize, convert) in a sandboxed process with resource limits.
- For ZIP files: validate the uncompressed size before extracting to prevent ZIP bomb attacks.

---

## 12. Security Logging

Source: `owasp.org/Top10/2021/A09_2021-Security_Logging_and_Monitoring_Failures`
OWASP Top 10: A09:2021

### What to log (for security)

Log every security-relevant event with enough context to investigate it:

- Failed authentication attempts (username/email, IP, timestamp — never the password)
- Successful authentication (user ID, IP, timestamp)
- Access control failures (user ID, resource attempted, action attempted)
- Input validation failures on sensitive endpoints (IP, endpoint, type of failure)
- Rate limit hits (IP, endpoint)
- Changes to sensitive data (user ID, what changed, timestamp)
- Admin actions (admin user ID, action, affected resource)

### What never to log

- Passwords — even hashed
- Session tokens, JWT tokens, API keys, secrets
- Full credit card numbers or payment data
- Social security numbers or national ID numbers
- Full request bodies on auth endpoints (may contain passwords)

### Log format for security events

Use structured logging with consistent fields for security events. This enables automated analysis and alerting.

```json
{
  "timestamp": "2026-06-15T10:30:00Z",
  "level": "warn",
  "event": "auth.failed",
  "ip": "192.168.1.100",
  "userId": null,
  "email": "alice@example.com",
  "reason": "invalid_password",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Rules

- Use `warn` level for failed auth attempts and access control failures
- Use `error` level for unexpected failures
- Never expose log contents to end users
- Store security logs in a location that application code cannot modify or delete
- Retain security logs for a minimum of 90 days

---

## 13. Server-Side Request Forgery (SSRF)

Source: `owasp.org/Top10/2021/A10_2021-Server-Side_Request_Forgery_%28SSRF%29`
OWASP Top 10: A10:2021

SSRF occurs when an application fetches a URL provided by user input. An attacker can use this to reach internal services, cloud metadata endpoints, or other resources the server can access but the attacker cannot directly.

### Rules

- Never make HTTP requests to URLs provided directly by user input.
- If users must provide URLs (e.g. webhook URLs, avatar URLs), validate them:
  - Only allow `https://` scheme. Reject `http://`, `file://`, `ftp://`, `gopher://`, etc.
  - Resolve the hostname and block requests to private IP ranges:
    - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (private)
    - `127.0.0.1`, `::1` (loopback)
    - `169.254.0.0/16` (link-local — AWS/GCP metadata endpoint is `169.254.169.254`)
  - Block requests to `localhost` and hostnames that resolve to private IPs
- Allowlist the domains your application is permitted to fetch from, if the set is known.
- Do not forward raw responses from internal services to the client.

```
# ❌ Vulnerable — fetches any URL the user provides
const response = await fetch(req.body.webhookUrl)

# ✅ Safe — validate before fetching
const url = new URL(req.body.webhookUrl)
if (url.protocol !== 'https:') throw new ValidationError('Only HTTPS URLs allowed')
if (isPrivateIP(url.hostname)) throw new ValidationError('Private URLs not allowed')
const response = await fetch(url.toString())
```

---

## 14. Anti-Patterns

**Never do these.**

### Input handling

- Trusting user input without validation at the server
- Using denylist validation instead of allowlist
- Validating only on the client side
- Passing raw unvalidated request body to a database query
- Using original user-supplied filenames for file storage

### Injection

- String interpolation in SQL queries
- `shell=True` or `{ shell: true }` with user-supplied input
- `eval()`, `exec()`, or `Function()` on user input
- `pickle.loads()` or equivalent on untrusted data
- Dynamic module import with user-controlled names

### XSS

- `dangerouslySetInnerHTML`, `innerHTML`, `v-html`, `[innerHTML]`, `| safe` with untrusted data
- `JSON.stringify()` embedded directly in HTML
- `unsafe-inline` or `unsafe-eval` in Content Security Policy
- Custom HTML sanitiser instead of DOMPurify or bleach

### Access control

- Checking auth only on the frontend
- Trusting role or permission values from the request body
- Returning `403 Forbidden` when a user accesses another user's resource (reveals existence — use `404`)
- Not checking resource ownership, only checking authentication

### Sensitive data

- Returning password hashes in API responses
- Storing passwords in plaintext or with MD5/SHA-1
- Using `Math.random()` or `random.random()` for security-sensitive random values
- Sending tokens or secrets in URL query parameters
- Logging passwords, tokens, or full PII

### Security headers

- `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`
- Reflecting the `Origin` header without allowlist validation
- Leaving `X-Powered-By` and `Server` version headers exposed
- No Content Security Policy

### Dependencies

- No `npm audit` or `pip-audit` in CI
- Installing packages without reviewing them
- Unpinned dependency versions
- Keeping unused dependencies

### SSRF

- Fetching URLs provided directly by user input
- Not blocking requests to private IP ranges and loopback addresses
- Allowing `http://`, `file://`, or other non-HTTPS schemes in user-provided URLs
