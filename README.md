# DigiTag Backend

Production-grade Node.js + Express backend for the DigiTag platform. Connects Creators and Freelancers via an OTP-based mobile auth flow, role-opposite feed, S3 image uploads, and a clean module-per-feature architecture designed to scale to Brands / Agencies / Admin.

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js (JavaScript, no TypeScript)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Storage:** AWS S3 (direct upload via multer-s3 + presigned URLs)
- **Auth:** Mobile OTP + JWT (access + refresh, rotation, revocation)
- **Validation:** Joi
- **Security:** helmet, cors, express-rate-limit
- **Logging:** winston + morgan

---

## Folder Structure

```
DigiTag-Backend/
├── prisma/
│   ├── schema.prisma
│   └── seed.js
├── src/
│   ├── app.js                      # Express app (middleware + routes)
│   ├── server.js                   # Bootstrap + graceful shutdown
│   ├── config/                     # env, db, s3
│   ├── constants/                  # roles, messages, status codes
│   ├── middlewares/                # auth, role, error, upload, validate
│   ├── modules/
│   │   ├── _shared/                # shared profile service/controller/validation
│   │   ├── auth/
│   │   ├── users/
│   │   ├── creators/
│   │   ├── freelancers/
│   │   ├── categories/
│   │   ├── posts/
│   │   ├── feeds/
│   │   └── uploads/
│   ├── services/
│   │   ├── otp/                    # pluggable OTP provider (mock/twilio/msg91)
│   │   ├── token/                  # JWT issue/rotate/revoke
│   │   └── s3/                     # S3 upload, delete, presigned URLs
│   ├── utils/                      # apiResponse, asyncHandler, pagination, logger
│   ├── validations/                # common Joi primitives
│   └── routes/
│       └── index.js                # API router mount point
├── .env.example
├── package.json
└── README.md
```

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment

```bash
cp .env.example .env
# then edit DATABASE_URL, JWT secrets, AWS, OTP provider, etc.
```

### 3. Database (Prisma)

```bash
# Generate Prisma client
npm run prisma:generate

# Run initial migration (creates tables)
npm run prisma:migrate -- --name init

# Seed categories
npm run db:seed
```

For production deployments:

```bash
npm run prisma:deploy
```

### 4. Run

```bash
# Dev (nodemon)
npm run dev

# Prod
npm start
```

Server boots at `http://localhost:5000` with API prefix `/api/v1`.

---

## Architecture Notes

### Authentication

- Mobile OTP is the primary auth. OTPs are hashed (SHA-256) before storage.
- Each OTP has expiry (`OTP_EXPIRY_MINUTES`) and limited attempts (`OTP_MAX_ATTEMPTS`).
- Resend cooldown (`OTP_RESEND_COOLDOWN_SECONDS`) prevents abuse.
- JWT access token (short-lived) + refresh token (rotated, stored hashed in DB).
- `OtpProvider` is an abstract interface — swap `mock` for Twilio/MSG91/Firebase by implementing and registering a provider in `src/services/otp/otp.service.js`.

### Role Model (scalable)

- `User` is the common auth table. `role` is a Prisma enum (`CREATOR | FREELANCER | BRAND | AGENCY | ADMIN`).
- Profile data lives in **separate tables** per role (`CreatorProfile`, `FreelancerProfile`).
- A shared factory (`src/modules/_shared/profileService.js`) builds role-specific services — adding `brands` or `agencies` = a new table + a 5-line module.

### Feed Logic

- `OPPOSITE_FEED_ROLE` map in `src/constants/roles.js` drives who-sees-whom.
  - `CREATOR` sees `FREELANCER` posts.
  - `FREELANCER` sees `CREATOR` posts.
  - `BRAND` / `AGENCY` see both CREATOR + FREELANCER posts (update as needed).
- Supports pagination, filters on `collaborationType`, `location`, `categoryId`, `search`.
- Newest first, with denormalized `role` on the post for index-friendly querying.

### Uploads

Two supported flows (both production-ready):

1. **Direct multipart upload** (`POST /uploads/image`, or inline on `POST /posts`) — `multer-s3` streams to S3.
2. **Presigned upload URL** (`POST /uploads/presigned`) — mobile/web client uploads directly to S3, then sends back `imageKey` + `imageUrl` when creating/updating.

Both public URL and S3 key are stored (`imageUrl`, `imageKey` / `profilePictureKey`), enabling later cleanup, signing, or CDN rewrites.

### Error Handling

- Central error middleware translates Prisma codes, Multer errors, and `ApiError` to a consistent response shape.
- All responses follow:

```json
{ "success": true|false, "message": "...", "data": {...}, "meta": {...}, "details": [...] }
```

### Security

- `helmet`, `cors`, global + per-route `express-rate-limit`, JWT auth middleware, role middleware (`authorize(...)`).
- Input validated with Joi on `body`, `query`, `params`.
- Soft-delete via `isActive` on `Post`.

---

## API Reference

Base URL: `/api/v1`

### Auth

| Method | Path                   | Auth | Description                          |
| ------ | ---------------------- | ---- | ------------------------------------ |
| POST   | `/auth/send-otp`       | —    | Send OTP to mobile                   |
| POST   | `/auth/verify-otp`     | —    | Verify OTP, create or login user     |
| POST   | `/auth/refresh-token`  | —    | Rotate refresh token                 |
| POST   | `/auth/logout`         | —    | Revoke refresh token                 |
| GET    | `/auth/me`             | ✅   | Current user + profile snapshot      |

### Categories

| Method | Path              | Auth | Description              |
| ------ | ----------------- | ---- | ------------------------ |
| GET    | `/categories`     | —    | List (filter by `role`)  |
| GET    | `/categories/:id` | —    | Single category          |

### Users

| Method | Path                         | Auth | Description                |
| ------ | ---------------------------- | ---- | -------------------------- |
| GET    | `/users/onboarding-status`   | ✅   | Profile completion status  |
| GET    | `/users/:id`                 | ✅   | Fetch a user + profiles    |

### Creator Profile

| Method | Path                       | Auth          | Description                  |
| ------ | -------------------------- | ------------- | ---------------------------- |
| POST   | `/creators/profile`        | CREATOR       | Create profile               |
| PUT    | `/creators/profile`        | CREATOR       | Update profile               |
| GET    | `/creators/profile/me`     | CREATOR       | My creator profile           |
| GET    | `/creators/:id`            | ✅            | Public creator profile       |

### Freelancer Profile

| Method | Path                         | Auth          | Description                  |
| ------ | ---------------------------- | ------------- | ---------------------------- |
| POST   | `/freelancers/profile`       | FREELANCER    | Create profile               |
| PUT    | `/freelancers/profile`       | FREELANCER    | Update profile               |
| GET    | `/freelancers/profile/me`    | FREELANCER    | My freelancer profile        |
| GET    | `/freelancers/:id`           | ✅            | Public freelancer profile    |

### Posts

| Method | Path            | Auth | Description                                      |
| ------ | --------------- | ---- | ------------------------------------------------ |
| POST   | `/posts`        | ✅   | Create post (`multipart/form-data` with `image`) |
| PUT    | `/posts/:id`    | ✅   | Update own post                                  |
| DELETE | `/posts/:id`    | ✅   | Soft-delete own post                             |
| GET    | `/posts/me`     | ✅   | List my posts                                    |
| GET    | `/posts/:id`    | ✅   | Get a post by id                                 |

### Feed

| Method | Path     | Auth | Description                                                |
| ------ | -------- | ---- | ---------------------------------------------------------- |
| GET    | `/feed`  | ✅   | Opposite-role posts, filters + pagination, newest first    |

### Uploads

| Method | Path                   | Auth | Description                                       |
| ------ | ---------------------- | ---- | ------------------------------------------------- |
| POST   | `/uploads/image`       | ✅   | Multipart image upload to S3                      |
| POST   | `/uploads/presigned`   | ✅   | Get presigned PUT URL for client-side upload      |

---

## Sample API Flow

### 1. Send OTP

```http
POST /api/v1/auth/send-otp
Content-Type: application/json

{
  "mobileNumber": "9876543210",
  "countryCode": "+91",
  "role": "CREATOR",
  "categoryId": "b0e6c6fa-..."
}
```

Response:

```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "otpId": "…",
    "expiresAt": "2026-04-17T10:05:00.000Z",
    "isNewUser": true,
    "devCode": "123456"
  }
}
```

> `devCode` is only included in non-production for easy testing.

### 2. Verify OTP

```http
POST /api/v1/auth/verify-otp
Content-Type: application/json

{
  "mobileNumber": "9876543210",
  "code": "123456",
  "role": "CREATOR",
  "categoryId": "b0e6c6fa-..."
}
```

Response:

```json
{
  "success": true,
  "message": "Logged in successfully",
  "data": {
    "user": { "id": "...", "role": "CREATOR", "isProfileCompleted": false, ... },
    "tokens": { "accessToken": "eyJhbGciOi...", "refreshToken": "eyJhbGciOi..." },
    "isNewUser": true,
    "isProfileCompleted": false
  }
}
```

### 3. Complete Creator Profile

```http
POST /api/v1/creators/profile
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Aarav Mehta",
  "email": "aarav@example.com",
  "categoryId": "b0e6c6fa-...",
  "language": "English",
  "bio": "Travel + lifestyle creator",
  "instagramLink": "https://instagram.com/aarav",
  "youtubeLink":   "https://youtube.com/@aarav",
  "snapchatLink":  "https://snapchat.com/add/aarav",
  "twitterLink":   "https://twitter.com/aarav",
  "location": "Mumbai, IN",
  "profilePicture": "https://.../users/uid/xxx.jpg",
  "profilePictureKey": "users/uid/xxx.jpg"
}
```

### 4. Create a Post (multipart)

```http
POST /api/v1/posts
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

image=@./post.jpg
description=Looking for a videographer for a Goa collab
collaborationType=PAID
location=Goa, IN
```

### 5. Get Feed (as creator → sees freelancer posts)

```http
GET /api/v1/feed?page=1&limit=20&collaborationType=PAID
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "message": "Fetched successfully",
  "data": [
    {
      "id": "…",
      "description": "Available in Goa next week",
      "imageUrl": "https://.../posts/uid/xxx.jpg",
      "collaborationType": "PAID",
      "role": "FREELANCER",
      "owner": { "id": "…", "role": "FREELANCER", "name": "…", "profilePicture": "…", "location": "…" },
      "createdAt": "…"
    }
  ],
  "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3, "hasNextPage": true, "hasPrevPage": false }
}
```

### 6. Refresh Tokens

```http
POST /api/v1/auth/refresh-token
Content-Type: application/json

{ "refreshToken": "eyJhbGciOi..." }
```

### 7. Logout

```http
POST /api/v1/auth/logout
Content-Type: application/json

{ "refreshToken": "eyJhbGciOi..." }
```

---

## Adding a New Role (e.g. Brand)

1. Add `BRAND` to the `UserRole` Prisma enum (already present).
2. Create `prisma` model `BrandProfile` mirroring `CreatorProfile`.
3. Run `npm run prisma:migrate -- --name add_brand_profile`.
4. Create `src/modules/brands/`:
   - `brand.service.js` → `buildProfileService({ model: 'brandProfile', role: 'BRAND' })`
   - `brand.controller.js` → `buildProfileController(service)`
   - `brand.validation.js` → re-export shared schemas
   - `brand.route.js` → wire routes with `authorize(ROLES.BRAND)`
5. Mount in `src/routes/index.js`.
6. Update `OPPOSITE_FEED_ROLE` if brands should have their own feed audience.

That's it. Zero changes to auth, uploads, posts, or feed logic.

---

## Commands

| Command                                      | Purpose                     |
| -------------------------------------------- | --------------------------- |
| `npm run dev`                                | Start dev server (nodemon)  |
| `npm start`                                  | Start prod server           |
| `npm run prisma:generate`                    | Regenerate Prisma client    |
| `npm run prisma:migrate -- --name <name>`    | Create dev migration        |
| `npm run prisma:deploy`                      | Apply migrations in prod    |
| `npm run prisma:studio`                      | Open Prisma Studio          |
| `npm run db:seed`                            | Seed category master data   |

---

## Roadmap Hooks (extensibility touchpoints)

- **Likes/Saves/Comments** — add tables referencing `Post(id)` + `User(id)`; follow the module pattern.
- **Follows** — self-referential `Follow(followerId, followeeId)`.
- **Chat** — introduce `Conversation` + `Message` tables; websocket layer can plug into `server.js`.
- **Notifications** — `Notification` table + event dispatcher service in `src/services/notifications/`.
- **Collaborations/Proposals** — `Proposal` model linking posters and applicants.
- **Admin Panel** — reuse the same modules, guard with `authorize(ROLES.ADMIN)`.
- **Moderation / Reports** — `Report` model + admin review routes.
- **Search & Filters** — add full-text search (Postgres `tsvector` or Meilisearch) behind the service layer.

All of the above slot into the existing module pattern without touching auth or core infrastructure.
