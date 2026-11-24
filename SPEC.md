# Technical Specification: Note-Taking Web Application

**Document version:** 1.0  
**Project status:** Initial development  
**Target environment:** Local PC  
**Application type:** Full-stack web application

---

# 1. Project Overview

## 1.1 Purpose

The purpose of this project is to build a web-based note-taking application that allows authenticated users to create, organize, edit, delete and publicly share their notes.

Each note consists of a title and a rich-text document created using the TipTap editor.

Users will have private access to their notes by default. They can optionally make individual notes publicly accessible through a unique sharing URL.

The application will initially run locally on the developer's computer, using SQLite for persistent data storage.

## 1.2 Project objectives

The application must allow users to:

- Register and authenticate using email and password.
- Create new notes.
- View a list of their notes.
- Open and edit existing notes.
- Delete notes.
- Save changes manually.
- Automatically save changes after a period of inactivity.
- Share individual notes publicly.
- Revoke public access to previously shared notes.
- View publicly shared notes without authentication.

## 1.3 Out of scope for the initial version

The following features are intentionally excluded from the first version:

- Collaborative editing.
- Real-time synchronization between users.
- Note folders and nested collections.
- Note tagging.
- File and image attachments.
- Note version history.
- Rich-text comments.
- Password-protected sharing.
- Expiring public links.
- Offline synchronization.
- Mobile applications.

The architecture should remain extensible enough to accommodate these features later.

# 2. Technology Stack

| Layer                     | Technology                                    |
| ------------------------- | --------------------------------------------- |
| Full-stack framework      | Next.js                                       |
| Application routing       | Next.js App Router                            |
| Runtime / package manager | Bun                                           |
| Programming language      | TypeScript                                    |
| Styling                   | TailwindCSS                                   |
| Authentication            | Better Auth                                   |
| Rich-text editor          | TipTap                                        |
| Database                  | SQLite                                        |
| Database driver           | Bun SQLite (`bun:sqlite`)                     |
| Database queries          | Raw SQL                                       |
| Validation                | Zod                                           |
| Identifiers               | UUID / cryptographically secure random tokens |

## 2.1 Architectural principles

The application should follow these principles:

1. Server-side operations are responsible for data access and authorization.
2. Client-side components are responsible for user interaction.
3. Database access must be isolated in a dedicated data-access layer.
4. All user input must be validated on the server.
5. Notes must always be associated with their authenticated owner.
6. Public sharing must use unpredictable tokens.
7. Autosave and manual save must use the same server-side update logic.
8. Authentication tables and application tables must be managed separately.

# 3. Application Architecture

## 3.1 High-level architecture

The application will use a relatively simple three-layer architecture.

```text
                 CLIENT
                   |
          Next.js App Router
                   |
          React Components
                   |
       +-----------+-----------+
       |                       |
   TipTap Editor          UI Components
       |                       |
       +-----------+-----------+
                   |
             SERVER LAYER
                   |
       +-----------+-----------+
       |                       |
 Better Auth              Note Services
       |                       |
       +-----------+-----------+
                   |
             DATA LAYER
                   |
             bun:sqlite
                   |
             SQLite File
```

## 3.2 Application responsibilities

### Client layer

Responsible for:

- Rendering the user interface.
- Displaying the user's notes.
- Managing the TipTap editor.
- Managing the formatting toolbar.
- Tracking unsaved changes.
- Triggering autosave and manual save.
- Displaying save status.
- Managing public-sharing interactions.

### Server layer

Responsible for:

- Authentication and session validation.
- Authorization and ownership verification.
- Validating incoming requests.
- Creating, retrieving, updating and deleting notes.
- Generating and revoking public sharing tokens.
- Returning public notes.
- Handling database transactions.

### Data layer

Responsible for:

- SQLite database initialization.
- Database connection management.
- Database migrations.
- Executing parameterized SQL queries.
- Managing application data.

## 3.3 Server-side versus client-side components

Use Next.js Server Components by default.

Client Components should be used only when browser interaction is required.

Examples:

| Component             | Type             |
| --------------------- | ---------------- |
| Notes page            | Server Component |
| Notes list            | Server Component |
| Note editor           | Client Component |
| Formatting toolbar    | Client Component |
| Save status indicator | Client Component |
| Share button          | Client Component |
| Public note page      | Server Component |
| Login form            | Client Component |

The TipTap editor must be implemented as a Client Component.

# 4. Authentication

## 4.1 Authentication provider

Better Auth will manage authentication and session management.

The initial authentication method will be email and password.

Users must be authenticated before accessing private application functionality.

## 4.2 Authentication requirements

The application must support:

- User registration.
- User login.
- User logout.
- Session verification.
- Protected application routes.
- Server-side session validation.

## 4.3 Authentication routes

| Route                | Description           | Access                                                              |
| -------------------- | --------------------- | ------------------------------------------------------------------- |
| `/register`          | User registration     | Public                                                              |
| `/login`             | User login            | Public                                                              |
| `/api/auth/[...all]` | Better Auth endpoints | Public endpoint, protected by authentication logic where applicable |
| `/notes`             | User's notes          | Authenticated                                                       |
| `/notes/new`         | Create a note         | Authenticated                                                       |

## 4.4 Authentication configuration

Better Auth should use the application's SQLite database.

Use Bun's built-in SQLite driver:

```ts
import { betterAuth } from "better-auth";
import { Database } from "bun:sqlite";

const db = new Database("./data/notes.sqlite");

export const auth = betterAuth({
  database: db,

  emailAndPassword: {
    enabled: true,
  },
});
```

This is a conceptual configuration. The actual implementation should use a single shared database connection and the appropriate server-only module.

Better Auth's database schema should be generated or migrated using its CLI (`bunx auth migrate`) rather than manually inventing authentication tables. See §5.2 for the resulting tables.

Authentication tables should be kept separate from application-specific tables.

## 4.5 Session validation

Every private server operation must validate the current session.

Never trust a user ID supplied by the browser.

The authenticated user ID must come from the validated Better Auth session.

Example conceptual implementation:

```ts
const session = await auth.api.getSession({
  headers: await headers(),
});

if (!session) {
  throw new Error("Unauthorized");
}

const userId = session.user.id;
```

The actual implementation should follow the current Next.js and Better Auth integration documentation.

# 5. Database Design

## 5.1 Database configuration

The application will use SQLite through Bun's built-in SQLite driver.

Database file:

```text
/data/notes.sqlite
```

The database file must be persistent and excluded from Git.

The application should automatically create the database directory when necessary.

Recommended SQLite configuration:

- Enable foreign key constraints.
- Enable WAL journal mode.
- Use parameterized SQL statements.
- Use transactions for multi-step operations.
- Configure a reasonable busy timeout.

For example:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
```

## 5.2 Better Auth tables

Better Auth owns four core tables: `user`, `session`, `account` and `verification`. Do not write these tables by hand. Create them with the Better Auth CLI:

```bash
bunx auth migrate    # apply the schema directly to the SQLite database
bunx auth generate   # or: write the SQL to a file for review first
```

The tables below are the default schema for Better Auth 1.7 with the SQLite adapter and no plugins. Plugins and `additionalFields` add columns or tables, so run the CLI again whenever the auth configuration changes.

Better Auth conventions for SQLite:

- Table and column names are **camelCase** (`userId`, `createdAt`). Application tables use snake_case. Keep the two conventions apart and do not rename Better Auth columns.
- IDs are random strings generated by Better Auth and stored as `text`. They are not UUIDs unless Better Auth is configured to generate UUIDs.
- Booleans are stored as `integer` (`0` / `1`).
- Dates are stored as ISO 8601 strings in columns declared as `date`.
- Foreign keys to `user.id` use `ON DELETE CASCADE`.

### `user`

| Column          | SQLite type | Constraints           | Description                           |
| --------------- | ----------- | --------------------- | ------------------------------------- |
| `id`            | text        | Primary key           | User identifier                       |
| `name`          | text        | Not null              | Display name                          |
| `email`         | text        | Not null, unique      | Email address used to sign in         |
| `emailVerified` | integer     | Not null, default `0` | Whether the email address is verified |
| `image`         | text        | Nullable              | Profile image URL                     |
| `createdAt`     | date        | Not null              | Creation timestamp                    |
| `updatedAt`     | date        | Not null              | Last modification timestamp           |

`name` is required. The registration form must collect it, or the application must supply a value when it calls `signUp.email`.

### `session`

| Column      | SQLite type | Constraints                       | Description                 |
| ----------- | ----------- | --------------------------------- | --------------------------- |
| `id`        | text        | Primary key                       | Session identifier          |
| `expiresAt` | date        | Not null                          | Session expiry              |
| `token`     | text        | Not null, unique                  | Session token               |
| `createdAt` | date        | Not null                          | Creation timestamp          |
| `updatedAt` | date        | Not null                          | Last modification timestamp |
| `ipAddress` | text        | Nullable                          | Client IP address           |
| `userAgent` | text        | Nullable                          | Client user agent           |
| `userId`    | text        | Not null, FK → `user.id`, indexed | Session owner               |

### `account`

Each sign-in method a user has is stored as one account row. For email-and-password sign-in, `providerId` is `credential` and the **password hash is stored here**, not on `user`.

| Column                  | SQLite type | Constraints                       | Description                                                      |
| ----------------------- | ----------- | --------------------------------- | ---------------------------------------------------------------- |
| `id`                    | text        | Primary key                       | Account identifier                                               |
| `accountId`             | text        | Not null                          | Account ID at the provider (the user ID for credential accounts) |
| `providerId`            | text        | Not null                          | Provider name (`credential` for email/password)                  |
| `userId`                | text        | Not null, FK → `user.id`, indexed | Account owner                                                    |
| `accessToken`           | text        | Nullable                          | OAuth access token                                               |
| `refreshToken`          | text        | Nullable                          | OAuth refresh token                                              |
| `idToken`               | text        | Nullable                          | OAuth ID token                                                   |
| `accessTokenExpiresAt`  | date        | Nullable                          | Access token expiry                                              |
| `refreshTokenExpiresAt` | date        | Nullable                          | Refresh token expiry                                             |
| `scope`                 | text        | Nullable                          | OAuth scopes                                                     |
| `password`              | text        | Nullable                          | Password hash (credential accounts only)                         |
| `createdAt`             | date        | Not null                          | Creation timestamp                                               |
| `updatedAt`             | date        | Not null                          | Last modification timestamp                                      |

The OAuth columns stay empty in version 1.0 because only email and password sign-in is enabled.

### `verification`

Stores short-lived values such as email-verification and password-reset tokens.

| Column       | SQLite type | Constraints       | Description                 |
| ------------ | ----------- | ----------------- | --------------------------- |
| `id`         | text        | Primary key       | Verification identifier     |
| `identifier` | text        | Not null, indexed | What the value is for       |
| `value`      | text        | Not null          | Verification value          |
| `expiresAt`  | date        | Not null          | Expiry                      |
| `createdAt`  | date        | Not null          | Creation timestamp          |
| `updatedAt`  | date        | Not null          | Last modification timestamp |

### Access rules for Better Auth tables

- Read and write these tables only through Better Auth's API (`auth.api.*` on the server, the auth client in the browser). Application SQL must not query them directly.
- The application uses only `user.id`, obtained from the validated session (see §4.5), as the owner key for notes.
- Deleting a user cascades to that user's sessions, accounts and notes.

## 5.3 Notes table

The application will have one primary application table named `notes`. Its owner column references Better Auth's `user` table.

### Schema

```sql
CREATE TABLE notes (
    id TEXT PRIMARY KEY,

    user_id TEXT NOT NULL,

    title TEXT NOT NULL DEFAULT 'Untitled',

    content TEXT NOT NULL,

    is_public INTEGER NOT NULL DEFAULT 0
        CHECK (is_public IN (0, 1)),

    share_token TEXT UNIQUE,

    revision INTEGER NOT NULL DEFAULT 1,

    created_at TEXT NOT NULL,

    updated_at TEXT NOT NULL,

    FOREIGN KEY (user_id)
        REFERENCES "user"(id)
        ON DELETE CASCADE,

    CHECK (
        (is_public = 0 AND share_token IS NULL)
        OR
        (is_public = 1 AND share_token IS NOT NULL)
    )
);
```

Apply the Better Auth migration before this one, because the foreign key requires the `user` table to exist. Quote `"user"` in application SQL to avoid confusion with the SQL keyword `USER`.

Store `created_at` and `updated_at` as ISO 8601 strings (`new Date().toISOString()`), the same format Better Auth uses, so timestamps across tables are comparable.

### Field descriptions

| Field         | Type    | Description                             |
| ------------- | ------- | --------------------------------------- |
| `id`          | TEXT    | Unique note identifier                  |
| `user_id`     | TEXT    | ID of the note owner                    |
| `title`       | TEXT    | Note title                              |
| `content`     | TEXT    | TipTap JSON document serialized as text |
| `is_public`   | INTEGER | Whether public sharing is enabled       |
| `share_token` | TEXT    | Unique public sharing token             |
| `revision`    | INTEGER | Version used for optimistic concurrency |
| `created_at`  | TEXT    | Creation timestamp                      |
| `updated_at`  | TEXT    | Last modification timestamp             |

The `revision` field is important for preventing older save requests from overwriting newer changes.

## 5.4 Database indexes

Add indexes to improve common queries.

```sql
CREATE INDEX idx_notes_user_id
ON notes(user_id);

CREATE INDEX idx_notes_user_updated
ON notes(user_id, updated_at DESC);

CREATE INDEX idx_notes_share_token
ON notes(share_token);
```

The unique constraint on `share_token` already creates a unique index, so the additional share-token index is optional and should not be duplicated unnecessarily.

## 5.5 TipTap JSON storage

The `content` column will store the TipTap document as serialized JSON.

Example:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": {
        "level": 1
      },
      "content": [
        {
          "type": "text",
          "text": "My first note"
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "This is my note."
        }
      ]
    }
  ]
}
```

Store the entire document, including its nodes and marks.

Do not store only the generated HTML.

This makes it possible to reload the original document into TipTap and continue editing it.

A new note should start with a valid empty TipTap document:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph"
    }
  ]
}
```

# 6. Note Management

## 6.1 Note creation

Authenticated users can create notes.

When creating a note:

1. Validate the authenticated session.
2. Generate a UUID for the note.
3. Assign the authenticated user's ID.
4. Set the default title to `Untitled`.
5. Initialize the TipTap content with an empty document.
6. Set `is_public` to `0`.
7. Set `share_token` to `NULL`.
8. Set `revision` to `1`.
9. Set creation and modification timestamps.
10. Insert the record into SQLite.

Notes must always be private when first created.

Example SQL:

```sql
INSERT INTO notes (
    id,
    user_id,
    title,
    content,
    is_public,
    share_token,
    revision,
    created_at,
    updated_at
)
VALUES (?, ?, ?, ?, 0, NULL, 1, ?, ?);
```

## 6.2 Note retrieval

Authenticated users can retrieve their own notes.

The notes listing should be ordered by the most recently updated note.

Example SQL:

```sql
SELECT
    id,
    title,
    is_public,
    created_at,
    updated_at
FROM notes
WHERE user_id = ?
ORDER BY updated_at DESC;
```

The listing does not need to retrieve the complete TipTap JSON content for every note.

Retrieve the content only when an individual note is opened.

## 6.3 Retrieve an individual note

```sql
SELECT *
FROM notes
WHERE id = ?
AND user_id = ?;
```

If the note does not exist or does not belong to the authenticated user, return a `404 Not Found`.

Using the same response for nonexistent and unauthorized notes avoids revealing whether another user's note exists.

## 6.4 Note updating

Users can update:

- The title.
- The TipTap content.

Every successful content update must:

- Update the `updated_at` timestamp.
- Increment the `revision` field.
- Verify note ownership.
- Verify the expected revision to prevent stale writes.

Conceptual SQL:

```sql
UPDATE notes
SET
    title = ?,
    content = ?,
    revision = revision + 1,
    updated_at = ?
WHERE id = ?
AND user_id = ?
AND revision = ?;
```

If zero rows are updated, the server must determine whether the note is missing or whether its revision is outdated.

A stale revision should produce a conflict response rather than silently overwriting newer data.

## 6.5 Note deletion

Users can permanently delete their own notes.

Example SQL:

```sql
DELETE FROM notes
WHERE id = ?
AND user_id = ?;
```

A deletion should also invalidate any public sharing URL.

Because the token is stored in the same row, deleting the note automatically removes the token.

The interface should ask for confirmation before permanent deletion.

# 7. TipTap Rich-Text Editor

## 7.1 Editor requirements

The editor will support the following formatting options.

| Formatting            | TipTap functionality |
| --------------------- | -------------------- |
| Bold                  | Bold                 |
| Italic                | Italic               |
| Heading 1             | Heading level 1      |
| Heading 2             | Heading level 2      |
| Heading 3             | Heading level 3      |
| Normal text           | Paragraph            |
| Inline code           | Code                 |
| Code snippets         | CodeBlock            |
| Bullet lists          | BulletList           |
| Horizontal separators | HorizontalRule       |

## 7.2 TipTap extensions

Use TipTap's `StarterKit` as the foundation.

It already includes most of the required extensions.

Configure it to enable:

- Bold
- Italic
- Heading
- Paragraph
- Inline Code
- CodeBlock
- BulletList
- ListItem
- HorizontalRule

Set heading levels to `[1, 2, 3]`.

Disable formatting features that are not part of the initial requirements, such as blockquotes, ordered lists, strikethrough and links.

This prevents the editor from creating document structures that the product does not officially support.

The exact StarterKit options should be checked against the installed TipTap version.

## 7.3 Editor initialization

When a note is opened:

1. Retrieve its content from the server.
2. Parse the serialized JSON.
3. Initialize TipTap with the document.
4. Display the formatting toolbar.
5. Allow users to edit the document.

The editor must not initialize with empty content and then accidentally overwrite the retrieved note.

## 7.4 Formatting toolbar

The toolbar should provide buttons for:

- Bold
- Italic
- Normal text
- Heading 1
- Heading 2
- Heading 3
- Inline code
- Code block
- Bullet list
- Horizontal rule

The toolbar should visually indicate active formatting based on the current editor selection.

## 7.5 Content validation

All TipTap JSON must be validated server-side.

Validation should ensure:

- The document root is a valid `doc` node.
- Only supported node types are accepted.
- Only supported marks are accepted.
- Heading levels are restricted to 1, 2 and 3.
- Document nesting follows the editor schema.
- The document does not exceed a reasonable maximum size.

Do not trust arbitrary JSON simply because it originated from the TipTap editor.

# 8. Saving Mechanism

The application must support both autosave and manual save.

Both mechanisms must use the same server-side update service.

## 8.1 Autosave

Autosave should automatically persist changes after the user stops editing.

Recommended debounce interval: **1.5 seconds**.

Behavior:

1. The user modifies the title or content.
2. The client marks the note as dirty.
3. A debounce timer starts.
4. Further changes reset the timer.
5. After 1.5 seconds without changes, the client initiates a save.
6. The server validates the session and note ownership.
7. The server validates the content.
8. The server updates SQLite.
9. The server returns the new revision.
10. The client updates its save status.

Only save when the current document differs from the last successfully saved document.

## 8.2 Manual save

A visible Save button must be available in the editor interface.

When clicked:

1. Cancel any pending autosave timer.
2. Collect the latest title and content.
3. Initiate an immediate save.
4. Prevent duplicate simultaneous save operations.
5. Update the revision on successful completion.
6. Display the successful save status.

Manual saving must not be disabled simply because autosave exists.

## 8.3 Save status

The interface must display the current save status.

| State    | Display                          |
| -------- | -------------------------------- |
| Clean    | All changes saved                |
| Dirty    | Unsaved changes                  |
| Saving   | Saving...                        |
| Saved    | Saved just now / last saved time |
| Error    | Unable to save. Retry.           |
| Conflict | Newer version detected           |

## 8.4 Race-condition prevention

This is one of the most important parts of the application.

Consider this scenario:

- Request A contains an older version of the note.
- Request B contains a newer version.
- Request B reaches the database first.
- Request A reaches the database afterward.

Without protection, request A could overwrite the newer content.

Use optimistic concurrency with the `revision` field.

Every update must include the revision that the client believes is current.

The server should only update the note if the revision matches.

A successful update increments the revision.

A failed revision check must return HTTP `409 Conflict`.

## 8.5 Save queue

Use a single save coordinator per open note.

Requirements:

- Do not run multiple saves concurrently for the same editor.
- If changes occur during an active save, remember that a newer document needs saving.
- Once the active save completes, save the latest document if necessary.
- Never replace newer local content with an older server response.
- Keep failed changes locally and allow retry.
- Cancel pending autosaves when manually saving.

The server must remain the final authority on persisted content.

## 8.6 Navigation and accidental data loss

Before leaving the editor:

- Attempt to save any pending changes.
- Warn the user if unsaved changes cannot be persisted.
- Use a browser `beforeunload` warning where appropriate.

Do not rely on browser-unload events as the primary saving mechanism. Browsers may terminate requests when a page closes.

# 9. Public Note Sharing

## 9.1 Sharing behavior

Users can share individual notes publicly.

A shared note becomes accessible to anyone possessing its public URL.

Authentication is not required to view a shared note.

Public visitors cannot modify or delete notes.

## 9.2 Sharing token generation

Each shared note must have a unique, unpredictable token.

Recommended implementation:

```ts
import { randomBytes } from "node:crypto";

const shareToken = randomBytes(32).toString("base64url");
```

This generates a cryptographically secure random token.

Do not use:

- The note ID.
- The user ID.
- Sequential numbers.
- Predictable slugs.
- Timestamps.

## 9.3 Enable public sharing

When the owner clicks Share:

1. Validate the authenticated session.
2. Verify note ownership.
3. Generate a new random token.
4. Set `is_public` to `1`.
5. Store the token.
6. Return the public URL.

Example SQL:

```sql
UPDATE notes
SET
    is_public = 1,
    share_token = ?,
    updated_at = ?
WHERE id = ?
AND user_id = ?;
```

The operation should be transactional where necessary.

If a note is already shared, return its existing public URL rather than unnecessarily rotating its token.

## 9.4 Public URL

Use the following route:

```text
/share/[shareToken]
```

Example:

```text
http://localhost:3000/share/AbCdEf123...
```

The public URL should contain only the sharing token.

## 9.5 Public note retrieval

A public visitor can retrieve a note only if:

- The token exists.
- The note has `is_public = 1`.
- The token matches the note.

Example SQL:

```sql
SELECT
    title,
    content,
    created_at,
    updated_at
FROM notes
WHERE share_token = ?
AND is_public = 1;
```

The public query must never return private information such as:

- Owner user ID.
- Authentication details.
- Session information.
- Internal database identifiers, unless explicitly needed.

The public page should display the note in read-only mode.

## 9.6 Revoke public sharing

When the owner clicks Stop sharing:

1. Validate the authenticated session.
2. Verify ownership.
3. Set `is_public` to `0`.
4. Set `share_token` to `NULL`.
5. Update the modification timestamp.

Example SQL:

```sql
UPDATE notes
SET
    is_public = 0,
    share_token = NULL,
    updated_at = ?
WHERE id = ?
AND user_id = ?;
```

The previous public URL must immediately stop granting access.

## 9.7 Sharing again

When a user shares a previously revoked note:

- Generate a new random token.
- Do not reuse the old token.
- Make the note publicly accessible again.

This ensures that anyone who had the old URL cannot regain access simply because the owner re-enables sharing.

## 9.8 Public page rendering

Public note pages should:

- Render the TipTap document without editing controls.
- Be accessible without authentication.
- Return `404 Not Found` for invalid or revoked tokens.
- Avoid exposing internal note information.
- Avoid displaying private editing controls.

Public pages should use `noindex` metadata to discourage search engine indexing.

This does not make a shared URL secret or guarantee that the page will never be indexed.

# 10. Application Routes and API Design

## 10.1 Page routes

| Route            | Description                    | Authentication |
| ---------------- | ------------------------------ | -------------- |
| `/`              | Application landing / redirect | Optional       |
| `/register`      | Registration                   | Public         |
| `/login`         | Login                          | Public         |
| `/notes`         | Notes dashboard                | Required       |
| `/notes/new`     | New note                       | Required       |
| `/notes/[id]`    | Edit note                      | Owner          |
| `/share/[token]` | Public note                    | Not required   |

## 10.2 API endpoints

I recommend using Next.js Route Handlers for the application data API.

Better Auth will retain its own authentication route handler.

| Method | Endpoint                | Description              |
| ------ | ----------------------- | ------------------------ |
| POST   | `/api/notes`            | Create a note            |
| GET    | `/api/notes`            | Retrieve user's notes    |
| GET    | `/api/notes/[id]`       | Retrieve individual note |
| PATCH  | `/api/notes/[id]`       | Update note              |
| DELETE | `/api/notes/[id]`       | Delete note              |
| POST   | `/api/notes/[id]/share` | Enable public sharing    |
| DELETE | `/api/notes/[id]/share` | Revoke public sharing    |
| GET    | `/api/share/[token]`    | Retrieve public note     |

All note-management endpoints must require authentication.

The public sharing retrieval endpoint must not require authentication.

## 10.3 Example request: Create note

```http
POST /api/notes
Content-Type: application/json
```

Request:

```json
{
  "title": "My first note",
  "content": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph"
      }
    ]
  }
}
```

Response:

```json
{
  "id": "uuid",
  "title": "My first note",
  "isPublic": false,
  "revision": 1,
  "createdAt": "2026-11-03T12:00:00.000Z",
  "updatedAt": "2026-11-03T12:00:00.000Z"
}
```

## 10.4 Example request: Update note

```http
PATCH /api/notes/[id]
Content-Type: application/json
```

Request:

```json
{
  "title": "Updated title",
  "content": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [
          {
            "type": "text",
            "text": "Updated content"
          }
        ]
      }
    ]
  },
  "expectedRevision": 1
}
```

Successful response:

```json
{
  "success": true,
  "revision": 2,
  "updatedAt": "2026-11-03T12:05:00.000Z"
}
```

If the revision is outdated, return:

```http
409 Conflict
```

## 10.5 HTTP status codes

| Status | Meaning                    |
| ------ | -------------------------- |
| 200    | Successful request         |
| 201    | Resource created           |
| 400    | Invalid request            |
| 401    | Unauthenticated            |
| 403    | Forbidden                  |
| 404    | Resource not found         |
| 409    | Revision conflict          |
| 422    | Invalid document structure |
| 500    | Internal server error      |

The API should return consistent JSON error responses without exposing SQL statements, filesystem paths, secrets or stack traces.

# 11. Security Requirements

Security must be implemented on the server, even though the application initially runs locally.

## 11.1 Authentication security

- Use Better Auth's session management.
- Never expose session secrets to the browser.
- Store passwords using Better Auth's supported secure password hashing.
- Protect all private note operations.
- Validate sessions server-side.

## 11.2 Authorization

A user must only be able to access and manage their own notes.

Every private note query must include the authenticated user's ID.

Never retrieve a note by ID alone and assume the requester owns it.

## 11.3 SQL injection prevention

Use parameterized SQL statements.

Never construct SQL queries by concatenating user-provided strings.

## 11.4 Public sharing security

- Use cryptographically secure tokens.
- Keep sharing tokens private from unauthorized users.
- Never expose a token for a private note.
- Revoke access immediately when sharing is disabled.
- Return only the data necessary to render a public note.

## 11.5 Rich-text security

TipTap JSON should be validated against the configured editor schema.

When rendering public notes, use TipTap's document rendering facilities or the editor in read-only mode.

Do not insert arbitrary user-supplied HTML using unsafe rendering methods.

## 11.6 Local environment security

The application will initially run on localhost.

Important considerations:

- Keep database files out of Git.
- Keep authentication secrets in environment variables.
- Do not expose the development server to public networks unnecessarily.
- Back up the SQLite database.
- Protect the PC account and local filesystem.

Public sharing URLs will initially be reachable only by people who can access the local server. Sharing a URL containing `localhost` with someone on another computer will not make the application accessible to them.

External public sharing will require hosting the application or providing a secure externally reachable server.

# 12. Project Folder Structure

Recommended structure:

```text
note-taking-app/
│
├── data/
│   └── notes.sqlite
│
├── public/
│
├── src/
│   │
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   │
│   │   ├── (dashboard)/
│   │   │   └── notes/
│   │   │       ├── page.tsx
│   │   │       ├── new/
│   │   │       └── [id]/
│   │   │
│   │   ├── share/
│   │   │   └── [token]/
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...all]/
│   │       ├── notes/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       └── share/
│   │       │           └── route.ts
│   │       └── share/
│   │           └── [token]/
│   │               └── route.ts
│   │
│   ├── components/
│   │   ├── editor/
│   │   │   ├── note-editor.tsx
│   │   │   ├── editor-toolbar.tsx
│   │   │   └── editor-content.tsx
│   │   │
│   │   ├── notes/
│   │   │   ├── note-list.tsx
│   │   │   ├── note-card.tsx
│   │   │   ├── note-title-input.tsx
│   │   │   └── delete-note-dialog.tsx
│   │   │
│   │   ├── sharing/
│   │   │   ├── share-button.tsx
│   │   │   └── share-dialog.tsx
│   │   │
│   │   └── ui/
│   │
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── auth.ts
│   │   │   └── auth-client.ts
│   │   │
│   │   ├── db/
│   │   │   ├── index.ts
│   │   │   ├── migrations/
│   │   │   └── schema.ts
│   │   │
│   │   ├── notes/
│   │   │   ├── note.service.ts
│   │   │   ├── note.repository.ts
│   │   │   ├── note.validation.ts
│   │   │   └── sharing.service.ts
│   │   │
│   │   └── utils/
│   │
│   ├── hooks/
│   │   └── use-note-save.ts
│   │
│   └── types/
│       └── note.ts
│
├── tests/
│   ├── auth/
│   ├── notes/
│   ├── sharing/
│   └── editor/
│
├── .env.local
├── .gitignore
├── package.json
├── tsconfig.json
└── next.config.ts
```

The folder structure is a recommendation, not a requirement. Keep the initial implementation small and avoid introducing unnecessary abstraction.

# 13. Error Handling

The application must handle common failures gracefully.

| Scenario                            | Expected behavior                      |
| ----------------------------------- | -------------------------------------- |
| User is not authenticated           | Redirect to login or return 401        |
| Note does not exist                 | Return 404                             |
| User does not own note              | Return 404                             |
| Invalid TipTap JSON                 | Return 422                             |
| Database unavailable                | Display an error                       |
| Autosave fails                      | Preserve local content and offer retry |
| Revision conflict                   | Prevent overwriting newer data         |
| Invalid sharing token               | Return 404                             |
| Sharing revoked                     | Public URL returns 404                 |
| Note deleted                        | Note becomes inaccessible              |
| User navigates with unsaved changes | Attempt save and warn if unsuccessful  |

# 14. Testing Strategy

Testing should cover the most important application behaviors.

## 14.1 Authentication tests

- Register a user.
- Log in with valid credentials.
- Reject invalid credentials.
- Log out.
- Reject unauthenticated access to private endpoints.

## 14.2 Note CRUD tests

- Create a note.
- Retrieve all owned notes.
- Retrieve an individual note.
- Update a note title.
- Update TipTap content.
- Delete a note.
- Prevent one user from accessing another user's notes.

## 14.3 Editor tests

- Render an empty document.
- Load saved JSON into TipTap.
- Apply bold formatting.
- Apply italic formatting.
- Apply all three heading levels.
- Insert inline code.
- Insert code blocks.
- Create bullet lists.
- Insert horizontal separators.
- Persist and reload the document without losing formatting.

## 14.4 Saving tests

- Autosave after inactivity.
- Reset the debounce timer when typing continues.
- Manual save persists immediately.
- Manual save cancels pending autosave.
- Avoid unnecessary saves when content has not changed.
- Handle failed saves.
- Retry failed saves.
- Prevent older requests from overwriting newer content.
- Warn users before losing unsaved changes.

## 14.5 Sharing tests

- Share a private note.
- Retrieve a shared note without authentication.
- Reject invalid tokens.
- Reject revoked tokens.
- Prevent public visitors from editing notes.
- Revoke sharing.
- Verify that the previous token no longer works.
- Share the note again and verify a new token is generated.

# 15. Implementation Roadmap

The application should be developed incrementally.

## Phase 1: Project initialization

Tasks:

- Initialize Next.js with Bun.
- Configure TypeScript.
- Install and configure TailwindCSS.
- Configure environment variables.
- Establish the project folder structure.
- Create the SQLite database connection.
- Configure server-only database access.

**Deliverable:** A working Next.js application with SQLite connectivity.

## Phase 2: Authentication

Tasks:

- Install Better Auth.
- Configure SQLite integration.
- Generate and apply Better Auth schema.
- Implement registration.
- Implement login.
- Implement logout.
- Implement session validation.
- Protect private routes.

**Deliverable:** Users can register, authenticate and access protected pages.

## Phase 3: Note CRUD

Tasks:

- Create the notes table.
- Implement note creation.
- Implement notes listing.
- Implement individual note retrieval.
- Implement note updates.
- Implement note deletion.
- Implement ownership verification.

**Deliverable:** Authenticated users can fully manage their notes.

## Phase 4: TipTap editor

Tasks:

- Install TipTap packages.
- Configure StarterKit.
- Configure heading levels.
- Disable unsupported formatting.
- Build the editor component.
- Build the formatting toolbar.
- Connect the editor to note content.
- Validate TipTap JSON on the server.

**Deliverable:** Users can create and edit rich-text notes.

## Phase 5: Saving system

Tasks:

- Implement dirty-state tracking.
- Implement debounced autosave.
- Implement manual save.
- Implement the save status indicator.
- Implement a centralized save coordinator.
- Implement revision-based concurrency protection.
- Handle network and database errors.
- Add navigation warnings for unsaved changes.

**Deliverable:** Reliable manual and automatic saving.

## Phase 6: Public sharing

Tasks:

- Implement secure token generation.
- Implement share functionality.
- Implement public note retrieval.
- Build the public note page.
- Implement stop-sharing functionality.
- Ensure old tokens are invalidated.
- Test public read-only access.

**Deliverable:** Notes can be shared and sharing can be revoked.

## Phase 7: Finalization

Tasks:

- Implement error states.
- Improve loading states.
- Test all application flows.
- Verify ownership and access control.
- Test database persistence across restarts.
- Verify the application works entirely locally.

**Deliverable:** A functional first version of the note-taking application.

# 16. Acceptance Criteria

The first version will be considered complete when all the following conditions are satisfied.

### Authentication

- [ ] Users can register.
- [ ] Users can log in.
- [ ] Users can log out.
- [ ] Private pages require authentication.

### Notes

- [ ] Users can create notes.
- [ ] Users can list their notes.
- [ ] Users can view individual notes.
- [ ] Users can update notes.
- [ ] Users can delete notes.
- [ ] Users cannot access other users' private notes.

### Rich-text editor

- [ ] Bold works.
- [ ] Italic works.
- [ ] Normal text works.
- [ ] H1, H2 and H3 work.
- [ ] Inline code works.
- [ ] Code blocks work.
- [ ] Bullet lists work.
- [ ] Horizontal separators work.
- [ ] Formatting survives saving and reloading.

### Saving

- [ ] Autosave works.
- [ ] Manual save works.
- [ ] Save status is visible.
- [ ] Failed saves preserve local content.
- [ ] Older save requests cannot overwrite newer content.
- [ ] Unsaved changes are handled when navigating away.

### Public sharing

- [ ] Users can share notes.
- [ ] Public notes are accessible without authentication.
- [ ] Public visitors have read-only access.
- [ ] Users can revoke sharing.
- [ ] Revoked links stop working.
- [ ] Sharing again generates a new token.

### Database

- [ ] SQLite persists data across application restarts.
- [ ] Foreign keys are enabled.
- [ ] SQL queries are parameterized.
- [ ] Database files are excluded from Git.

# 17. Future Improvements

The architecture can be extended later with:

- Folders and tags.
- Search and filtering.
- Favorites and pinned notes.
- Note archiving.
- Trash and recovery.
- Note version history.
- Markdown import and export.
- Collaborative editing.
- Sharing permissions.
- Password-protected public links.
- Cloud deployment.
- Database backups and restoration.

These features should not be implemented until the initial application is stable.

# 18. Final Architectural Decisions

The following decisions are considered authoritative for version 1.0.

| Decision              | Choice                                                                           |
| --------------------- | -------------------------------------------------------------------------------- |
| Framework             | Next.js App Router                                                               |
| Runtime               | Bun                                                                              |
| Language              | TypeScript                                                                       |
| Styling               | TailwindCSS                                                                      |
| Authentication        | Better Auth                                                                      |
| Authentication method | Email and password                                                               |
| Rich-text editor      | TipTap                                                                           |
| Editor content        | JSON                                                                             |
| Formatting            | Bold, italic, headings, inline code, code blocks, bullet lists, horizontal rules |
| Database              | SQLite                                                                           |
| Database driver       | Bun SQLite                                                                       |
| Database queries      | Raw SQL                                                                          |
| Note title            | Separate text field                                                              |
| Note content          | TipTap JSON                                                                      |
| Saving                | Autosave and manual save                                                         |
| Autosave debounce     | 1.5 seconds                                                                      |
| Concurrency           | Optimistic locking using revision                                                |
| Sharing               | Random cryptographic token                                                       |
| Public access         | Read-only                                                                        |
| Revocation            | Invalidate existing token                                                        |
| Deployment            | Local PC                                                                         |

**End of technical specification.**
