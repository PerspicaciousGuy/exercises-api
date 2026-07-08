# Authentication Guidelines

<!-- meta
target: language-agnostic
last_reviewed: 2026-06
sources: datatracker.ietf.org (RFC 7519, RFC 8725, RFC 9700, RFC 9449), cheatsheetseries.owasp.org, auth0.com/docs
extends: security-rules.md
-->

> Language-agnostic authentication implementation rules. Apply these to every project that implements authentication. These rules cover JWT, refresh token rotation, token storage, session management, password handling, password reset flows, OAuth2, and MFA. Security headers, CORS, and CSRF rules are covered in `security-rules.md`.

---

## Table of Contents

1. [Auth Strategy Decision](#1-auth-strategy-decision)
2. [JWT — Structure and Signing](#2-jwt--structure-and-signing)
3. [JWT — Validation Rules](#3-jwt--validation-rules)
4. [Access Tokens](#4-access-tokens)
5. [Refresh Tokens and Rotation](#5-refresh-tokens-and-rotation)
6. [Token Storage](#6-token-storage)
7. [Session-Based Authentication](#7-session-based-authentication)
8. [Password Handling](#8-password-handling)
9. [Password Reset Flow](#9-password-reset-flow)
10. [Account Security](#10-account-security)
11. [OAuth2 Rules](#11-oauth2-rules)
12. [Multi-Factor Authentication](#12-multi-factor-authentication)
13. [Anti-Patterns](#13-anti-patterns)

---

## 1. Auth Strategy Decision

Source: `cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html`

Choose the right strategy before implementing anything.

### When to use session-based auth

- Server-rendered applications (traditional web apps)
- Applications where server-side session invalidation is required immediately (e.g. financial apps)
- When all services share the same domain and cookie store

### When to use JWT-based auth

- APIs consumed by mobile apps or third-party clients
- Microservices that need stateless, distributed auth
- SPAs where the API is on a different domain from the frontend

### When to delegate to an auth provider

If the project requires any of the following, use a dedicated auth provider (Auth0, Clerk, Supabase Auth, NextAuth) instead of building auth from scratch:
- OAuth2 social login (Google, GitHub, etc.)
- Multi-tenancy
- Enterprise SSO (SAML, OIDC)
- MFA out of the box

Building auth from scratch is one of the highest-risk things a team can do. Use a dedicated provider wherever possible.

---

## 2. JWT — Structure and Signing

Source: `datatracker.ietf.org/doc/html/rfc7519`, `datatracker.ietf.org/doc/html/rfc8725`

### Algorithm

Use **RS256** (asymmetric) for production. Avoid HS256 (symmetric) unless you control both the issuer and all consumers.

```
# ✅ RS256 — asymmetric
# Private key signs the token (keep secret)
# Public key verifies the token (can be distributed)

# ⚠️ HS256 — symmetric
# Same secret used to sign and verify
# Every service that verifies tokens must share the secret
# Acceptable only when you control all verifiers
```

Never use `alg: none`. It disables signature verification entirely.

Source: RFC 8725 Section 3.1 — the `none` algorithm vulnerability was a widespread attack vector.

### Required claims

Every JWT must include these standard claims (RFC 7519):

| Claim | Description | Rule |
|---|---|---|
| `iss` (issuer) | Who issued the token | Must be set and validated |
| `sub` (subject) | Who the token represents (user ID) | Must be set and validated |
| `aud` (audience) | Who the token is intended for | Must be set and validated |
| `exp` (expiration) | When the token expires (Unix timestamp) | Must be set and validated |
| `iat` (issued at) | When the token was issued | Must be set |
| `jti` (JWT ID) | Unique ID for the token | Must be set for refresh tokens |

```ts
// ✅ Correct JWT payload
{
  "iss": "https://api.yourdomain.com",
  "sub": "user_01j5k8x3p9q2r4n7",
  "aud": "https://api.yourdomain.com",
  "exp": 1735689600,
  "iat": 1735686000,
  "jti": "550e8400-e29b-41d4-a716-446655440000",
  "role": "user"
}
```

### What not to put in JWT payload

JWT payloads are base64-encoded — not encrypted. Anyone who obtains the token can read the payload. Never include:

- Passwords or password hashes
- Secrets or API keys
- Full PII (SSN, credit card numbers, full address)
- Sensitive business data

Include only what is necessary for the auth decision: user ID, role, and essential claims.

### Explicit typing

Use the `typ` header parameter to prevent token confusion attacks — where a token issued for one purpose is used for another.

```
# Access token
{ "alg": "RS256", "typ": "at+JWT" }

# Refresh token
{ "alg": "RS256", "typ": "rt+JWT" }
```

Source: RFC 8725 Section 3.11 — explicit typing prevents substitution attacks.

---

## 3. JWT — Validation Rules

Source: `datatracker.ietf.org/doc/html/rfc8725`, `cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html`

Every JWT must be fully validated before trusting any claims. Partial validation is the same as no validation.

### Mandatory validation steps

Perform every step in this order. Stop and reject the token if any step fails.

1. **Verify the signature** — the token has not been tampered with.
2. **Check `alg` header** — must match the expected algorithm. Reject if `none` or unexpected.
3. **Check `iss` claim** — must match the expected issuer exactly.
4. **Check `aud` claim** — must include this service's identifier.
5. **Check `exp` claim** — current time must be before expiration.
6. **Check `typ` header** — must match the expected token type (`at+JWT` for access, `rt+JWT` for refresh).

```ts
// ✅ Complete validation with jsonwebtoken (Node.js)
import jwt from 'jsonwebtoken';

const payload = jwt.verify(token, publicKey, {
  algorithms: ['RS256'],             // never allow 'none'
  issuer: 'https://api.yourdomain.com',
  audience: 'https://api.yourdomain.com',
});
// exp is validated automatically by jsonwebtoken
```

### Use a library — never implement manually

Never write JWT parsing or validation code from scratch. Use a well-maintained library.

- Node.js: `jsonwebtoken`, `jose`
- Python: `python-jose`, `PyJWT`

Verify the library enforces algorithm checking. Some older libraries accepted the `alg` value from the token header without checking it against the expected algorithm — this enables the `none` attack.

### Clock skew

Allow a small tolerance (maximum 60 seconds) for clock skew between servers when validating `exp` and `iat`. Do not allow more than 60 seconds — it creates a meaningful window for token replay.

---

## 4. Access Tokens

Source: `datatracker.ietf.org/doc/rfc9700`, `auth0.com/docs/secure/tokens/token-best-practices`

### Expiry

Access tokens must be short-lived. They cannot be individually revoked (stateless), so limiting their lifetime limits the damage window if stolen.

| Token type | Recommended expiry |
|---|---|
| Access token (standard) | 15 minutes |
| Access token (high-security, e.g. banking) | 5 minutes |
| Access token (low-security, e.g. public API) | 1 hour (maximum) |

Never set access token expiry to more than 24 hours. Doing so essentially makes them permanent credentials.

### Transmission

Always transmit access tokens in the `Authorization` header as a Bearer token. Never in URL query parameters.

```
# ✅ Authorization header
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6ImF0K0pXVCJ9...

# ❌ URL query parameter — logged in server logs, browser history, Referer headers
GET /api/users?token=eyJhbGciOiJSUzI1NiIsInR5cCI6ImF0K0pXVCJ9...
```

### Audience restriction

Source: RFC 9700 Section 2.3

Restrict access tokens to the specific API they are issued for. Set the `aud` claim to the API identifier. The API must reject tokens not issued for it.

```
# Token issued for the users API
{ "aud": "https://api.yourdomain.com/users" }

# Token issued for the payments API
{ "aud": "https://api.yourdomain.com/payments" }
```

This prevents a token stolen from one service being replayed at another.

### Minimum privilege

Include only the permissions (scopes) the client actually needs. Do not issue a token with all permissions because it is convenient.

---

## 5. Refresh Tokens and Rotation

Source: `datatracker.ietf.org/doc/rfc9700` Section 4.14, `auth0.com/docs/secure/tokens/refresh-tokens`

### What refresh tokens do

Refresh tokens are long-lived credentials used to obtain new access tokens without requiring the user to re-authenticate. They are issued once at login and stored securely.

### Refresh token rotation (mandatory)

Every time a refresh token is used to obtain a new access token, issue a new refresh token and invalidate the old one. This is required per RFC 9700 for public clients.

```
Login
  → Issue access token (15 min) + refresh token RT1

Access token expires
  → Client sends RT1
  → Server validates RT1, issues:
      - New access token
      - New refresh token RT2
      - Invalidates RT1

Next expiry
  → Client sends RT2
  → Server validates RT2, issues:
      - New access token
      - New refresh token RT3
      - Invalidates RT2
```

### Refresh token reuse detection

If a refresh token that has already been used (rotated) is presented again, it is a signal that the token was stolen. Immediately invalidate the entire token family (all refresh tokens for that session) and force re-authentication.

```ts
// Detecting replay of a rotated token
async function refreshTokens(providedToken: string) {
  const stored = await tokenStore.findByToken(providedToken);

  if (!stored) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  if (stored.used) {
    // Token was already rotated — possible theft. Invalidate all tokens for this session.
    await tokenStore.invalidateFamily(stored.familyId);
    throw new UnauthorizedError('Refresh token reuse detected — please log in again');
  }

  // Mark token as used, issue new pair
  await tokenStore.markUsed(stored.id);
  return issueNewTokenPair(stored.userId, stored.familyId);
}
```

### Refresh token storage

Refresh tokens must be stored server-side. Store a hash of the token, not the raw value.

```ts
// ✅ Store hash, not raw token
const rawToken = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
await db.refreshToken.create({
  data: {
    tokenHash,
    userId,
    familyId,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  },
});
```

### Refresh token expiry

| Expiry type | Value | Description |
|---|---|---|
| Absolute expiry | 30 days | Token expires regardless of usage |
| Idle expiry | 7 days | Token expires if unused for 7 days |

Always apply both. Absolute expiry ensures tokens cannot be used forever. Idle expiry cleans up inactive sessions.

### Rules

- Never use a JWT as a refresh token — JWTs are stateless and cannot be individually invalidated. Use an opaque random token stored in the database.
- Always store refresh tokens hashed (SHA-256). Never store the raw value.
- Always implement refresh token rotation.
- Always implement reuse detection and full token family invalidation on reuse.
- On logout, immediately invalidate the refresh token in the database.

---

## 6. Token Storage

Source: `cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html`, `datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps`

### The fundamental rule

Do not store authentication tokens, session IDs, JWTs, refresh tokens, or any credential in `localStorage` or `sessionStorage`. These APIs are accessible to any JavaScript executing in the origin, so a single XSS vulnerability discloses every token.

### Storage options by client type

**Browser-based SPA (most secure option): HttpOnly cookies + BFF pattern**

The Backend-for-Frontend (BFF) pattern keeps tokens entirely on the server. The SPA communicates with a backend that holds the tokens and proxies requests to the API.

```
Browser ←→ BFF (holds tokens in HttpOnly cookie session) ←→ API
```

Cookie requirements:
```
Set-Cookie: session=...; HttpOnly; Secure; SameSite=Strict; Path=/
```

- `HttpOnly` — JavaScript cannot read the cookie. XSS cannot steal it.
- `Secure` — only sent over HTTPS.
- `SameSite=Strict` — not sent on cross-site requests (CSRF protection).

**Browser-based SPA (alternative): In-memory storage**

Store access tokens in a JavaScript variable (not `localStorage`). They are cleared when the page is closed. Use refresh tokens in HttpOnly cookies to obtain new access tokens.

```ts
// ✅ Access token in memory — not localStorage
let accessToken: string | null = null;

async function getAccessToken(): Promise<string> {
  if (accessToken && !isExpired(accessToken)) {
    return accessToken;
  }
  // Refresh from cookie-based session
  const response = await fetch('/auth/refresh', { credentials: 'include' });
  const data = await response.json();
  accessToken = data.accessToken;
  return accessToken;
}
```

**Never:** `localStorage.setItem('token', accessToken)` or `sessionStorage.setItem('token', accessToken)`.

**Mobile apps: Secure storage**

- iOS: Keychain
- Android: Keystore / EncryptedSharedPreferences
- React Native: `react-native-keychain`
- Flutter: `flutter_secure_storage`

Never store tokens in plain `AsyncStorage` (React Native) or `SharedPreferences` (Android).

**Server-side clients (Node.js, Python backend): Environment / in-memory**

Store tokens in memory or in a secrets manager. Never in a file on disk.

---

## 7. Session-Based Authentication

Source: `cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html`

### Session ID requirements

- Generate session IDs using a cryptographically secure random number generator
- Minimum 128 bits (16 bytes) of entropy
- Never use sequential or predictable session IDs

```ts
// ✅ Node.js — cryptographically secure
import { randomBytes } from 'node:crypto';
const sessionId = randomBytes(32).toString('hex'); // 256 bits

// Python
import secrets
session_id = secrets.token_hex(32)  # 256 bits
```

### Session cookie requirements

```
Set-Cookie: sessionId=<value>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400
```

- `HttpOnly` — mandatory. Prevents JavaScript access.
- `Secure` — mandatory in production. Only sent over HTTPS.
- `SameSite=Strict` — mandatory. Prevents CSRF.
- `Path=/` — restrict to the application root.
- `Max-Age` — set an explicit expiry. Never rely on session cookies expiring when the browser closes.

### Session lifecycle rules

- **Regenerate the session ID on login.** Always issue a new session ID after a user authenticates. Never reuse the pre-login session ID — this prevents session fixation attacks.
- **Regenerate the session ID on privilege escalation.** When a user gains elevated access (admin mode, sensitive operation), issue a new session ID.
- **Invalidate on logout.** Delete the session server-side on logout. Setting the cookie to an empty value or past expiry is not sufficient — the server-side session must be destroyed.
- **Absolute timeout.** Invalidate the session after a fixed duration (e.g. 24 hours) regardless of activity.
- **Idle timeout.** Invalidate the session after a period of inactivity (e.g. 30 minutes).

---

## 8. Password Handling

Source: `cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html`, `cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html`

### Hashing algorithm

Use **Argon2id** as the primary choice. Fall back to scrypt, then bcrypt for legacy systems only.

| Algorithm | Configuration | Notes |
|---|---|---|
| **Argon2id** (preferred) | 19 MiB memory, 2 iterations, 1 parallelism | Best resistance to GPU attacks |
| **scrypt** (alternative) | N=2^17, r=8, p=1 | Use when Argon2id unavailable |
| **bcrypt** (legacy only) | Work factor ≥ 10, max 72 bytes input | Do not use for new systems |

Never use MD5, SHA-1, SHA-256, or any fast hash for passwords. They allow billions of guesses per second.

```ts
// Node.js — Argon2id
import argon2 from 'argon2';

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,  // 19 MiB
    timeCost: 2,
    parallelism: 1,
  });
}

async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

// Python — Argon2id
from argon2 import PasswordHasher
ph = PasswordHasher(memory_cost=19456, time_cost=2, parallelism=1)
hash = ph.hash(password)
ph.verify(hash, password)  # raises exception on mismatch
```

### Password policy

Source: NIST SP 800-63B (via OWASP Authentication Cheat Sheet)

- Minimum length: **8 characters**
- Maximum length: **64 characters** (to allow passphrases)
- Allow all characters including spaces, unicode, and special characters
- Do not enforce composition rules (must have uppercase, number, symbol) — they reduce security by making passwords predictable
- Do not require periodic password rotation
- Check new passwords against a list of known compromised passwords

### Timing attacks on login

Always hash the provided password even when the user does not exist. This prevents timing attacks that reveal whether an account exists.

```ts
// ❌ Timing leak — fast exit reveals account does not exist
async function login(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new UnauthorizedError('Invalid credentials'); // exits early
  const valid = await argon2.verify(user.passwordHash, password); // only reached if user exists
  if (!valid) throw new UnauthorizedError('Invalid credentials');
}

// ✅ Constant time — always performs the hash operation
const DUMMY_HASH = await argon2.hash('dummy-to-prevent-timing-leak');

async function login(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  const hashToVerify = user?.passwordHash ?? DUMMY_HASH;
  const valid = user ? await argon2.verify(hashToVerify, password) : false;
  if (!user || !valid) throw new UnauthorizedError('Invalid credentials');
}
```

### On successful password change

- Require the current password before allowing a change
- Invalidate all existing sessions and refresh tokens after a password change
- Send an email notification that the password was changed

---

## 9. Password Reset Flow

Source: `cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html`

### Reset token requirements

- Generate using a cryptographically secure random number generator (minimum 32 bytes = 256 bits)
- Single use — invalidate immediately after use
- Short expiry — 15 to 60 minutes maximum
- Stored as a hash in the database (never the raw value)
- Linked to a specific user — cannot be used for any other account

```ts
// ✅ Generate and store reset token
import { randomBytes, createHash } from 'node:crypto';

const rawToken = randomBytes(32).toString('hex');
const tokenHash = createHash('sha256').update(rawToken).digest('hex');

await db.passwordResetToken.create({
  data: {
    tokenHash,
    userId: user.id,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    used: false,
  },
});

// Send rawToken to user via email — never the hash
await sendPasswordResetEmail(user.email, rawToken);
```

### Reset flow rules

1. **Return the same response for existing and non-existing emails.** Never reveal whether an account exists.
   ```
   # ✅ Same response always
   "If an account with this email exists, a reset link has been sent."

   # ❌ Reveals account existence
   "No account found with this email."
   ```

2. **Use HTTPS URLs.** Never send reset links over HTTP.

3. **Hard-code the reset URL base.** Never construct the reset URL from the `Host` header — it can be manipulated.
   ```ts
   // ✅ Hard-coded base URL from config
   const resetUrl = `${config.APP_URL}/reset-password?token=${rawToken}`;

   // ❌ Host header injection
   const resetUrl = `${req.headers.host}/reset-password?token=${rawToken}`;
   ```

4. **Invalidate after use.** Once the reset is complete, mark the token as used immediately.

5. **Invalidate on new password set.** After resetting the password, invalidate all existing sessions and refresh tokens for the user.

6. **Do not auto-login after reset.** After the password is successfully changed, redirect to the login page. Do not automatically create a session — it adds complexity and attack surface.

7. **Rate limit the reset endpoint** — see `security-rules.md` rate limiting section.

8. **Add `Referrer-Policy: no-referrer`** to the reset password page to prevent the token appearing in Referrer headers.

---

## 10. Account Security

Source: `cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html`

### Account lockout

After repeated failed login attempts, temporarily lock the account or introduce a delay.

| Failed attempts | Response |
|---|---|
| 3-4 | Introduce progressive delay (e.g. 1 second per attempt) |
| 5 | Lock account for 15–30 minutes |
| 10+ | Lock account until manual unlock or password reset |

Rules:
- Always return the same error message for invalid username and invalid password: `"Invalid username or password"`. Never distinguish between them.
- Increment the lockout counter on every failed attempt, regardless of whether the username exists.
- Reset the counter on successful login.
- Notify the user via email when their account is locked.

### Login response timing

Return auth responses in constant time. Use timing-safe comparison functions for password verification. Never short-circuit the response based on whether the user was found.

### Sensitive action verification

For sensitive operations (password change, email change, payment, account deletion), require the user to re-verify their current password or re-authenticate — even if they have an active session.

---

## 11. OAuth2 Rules

Source: `datatracker.ietf.org/doc/rfc9700` (RFC 9700 — Best Current Practice for OAuth 2.0 Security)

### Always use PKCE

Use PKCE (Proof Key for Code Exchange) for all OAuth2 authorization code flows. This applies to both public clients (SPAs, mobile apps) and confidential clients.

```
# PKCE flow
1. Client generates code_verifier (random 43–128 char string)
2. Client computes code_challenge = BASE64URL(SHA256(code_verifier))
3. Client sends code_challenge and method=S256 in auth request
4. Auth server stores code_challenge
5. Client sends code_verifier in token request
6. Auth server verifies SHA256(code_verifier) == code_challenge
```

### State parameter

Always use the `state` parameter to prevent CSRF on the redirect. Generate a cryptographically random value, store it in session, and verify it when the redirect returns.

```ts
// Before redirect
const state = crypto.randomBytes(16).toString('hex');
session.oauthState = state;
// Include state in authorization URL

// After redirect
if (req.query.state !== session.oauthState) {
  throw new UnauthorizedError('Invalid OAuth state parameter');
}
delete session.oauthState;
```

### Redirect URI

Register exact redirect URIs with the authorization server. Never use wildcard or pattern-matched redirect URIs. Validate the redirect URI on every authorization request.

### Token handling

- Exchange the authorization code for tokens server-side — never in the browser
- Never expose client secrets in browser-side code or mobile apps
- Store OAuth2 refresh tokens with the same security as session tokens

### Rules

- Never use the implicit flow — it is deprecated in OAuth 2.1 and RFC 9700
- Never use `response_type=token` (implicit) — always use `response_type=code` with PKCE
- Always validate the `state` parameter
- Always use exact redirect URI matching
- Never pass access tokens in URL query parameters

---

## 12. Multi-Factor Authentication

Source: `cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html`

### TOTP (Time-Based One-Time Password)

TOTP is the recommended MFA method. Use an authenticator app (Google Authenticator, Authy, 1Password).

**Implementation rules:**
- Use a well-maintained TOTP library. Never implement TOTP yourself.
  - Node.js: `otpauth`, `speakeasy`
  - Python: `pyotp`
- Store the TOTP secret encrypted at rest
- Generate and display the QR code only once during setup — never again
- Verify the TOTP code is within the valid time window (±30 seconds)
- Accept only one use of each code — mark codes as used to prevent replay

### Backup codes

Always provide backup codes when MFA is enabled. These allow account recovery if the MFA device is lost.

- Generate 8–10 single-use backup codes
- Each code must be 8–12 characters, alphanumeric
- Hash backup codes before storage — treat them as passwords
- Clearly show the codes once at setup — never again
- Allow the user to regenerate codes (which invalidates old ones)

### MFA enforcement rules

- After successful password verification, do not establish a full session until MFA is also verified
- Use a temporary, short-lived token (5 minutes) between the password step and MFA step
- If MFA verification fails, increment the account lockout counter
- Always verify MFA for sensitive actions (password change, MFA device change) even within an active session
- Never allow MFA to be bypassed without going through the account recovery flow

---

## 13. Anti-Patterns

**Never do these.**

### JWT

- `alg: none` in the JWT header — disables signature verification
- Accepting the algorithm from the token header without checking against the expected algorithm
- Not validating `iss`, `aud`, or `exp` claims
- Storing sensitive data (passwords, secrets, full PII) in the JWT payload
- Using the same key for signing and verifying in multi-service environments (HS256 shared secret)
- Using a JWT as a refresh token — JWTs cannot be individually revoked
- Setting access token expiry longer than 1 hour
- Not including `typ` header — enables token confusion attacks

### Token storage

- Storing tokens in `localStorage` or `sessionStorage` — a single XSS vulnerability exposes them
- Storing tokens in URL query parameters — they appear in logs and browser history
- Storing mobile tokens in unencrypted storage (`AsyncStorage`, plain `SharedPreferences`)
- Putting refresh tokens in the same storage as access tokens without additional protection

### Refresh tokens

- Not implementing rotation — stolen refresh tokens can be used indefinitely
- Not implementing reuse detection — a reused rotated token is a clear theft signal that goes undetected
- Using JWTs as refresh tokens — cannot be individually invalidated
- Not storing token hashes — exposes raw tokens if the database is compromised
- No absolute expiry on refresh tokens — they become permanent credentials

### Passwords

- Hashing with MD5, SHA-1, or any fast hash algorithm
- Not salting passwords (any modern library handles this automatically — do not implement manually)
- bcrypt with work factor below 10
- Truncating passwords silently before hashing (bcrypt 72-byte limit)
- Enforcing composition rules (uppercase + number + symbol) instead of minimum length
- Periodic forced password rotation
- Different error messages for wrong username vs wrong password

### Password reset

- Tokens that do not expire
- Tokens that can be used multiple times
- Storing raw tokens in the database instead of hashes
- Constructing reset URLs from the `Host` header
- Revealing whether an email address is registered

### Sessions

- Not regenerating session ID after login (session fixation)
- Not invalidating the server-side session on logout
- No idle timeout or absolute session timeout
- Session IDs generated with non-cryptographic random functions

### OAuth2

- Using the implicit flow
- Not using PKCE
- Not validating the `state` parameter
- Wildcard or pattern-matched redirect URIs
- Exposing client secrets in browser-side or mobile app code
- Exchanging authorization codes in the browser instead of server-side
