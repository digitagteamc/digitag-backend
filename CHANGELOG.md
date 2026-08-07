# Changelog

All notable changes to the DigiTag backend are documented here, one line per notable fix or feature. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## Unreleased

### Fixed
- Duplicate-profile race condition: concurrent login/switch-role requests could each create a separate `User` row for the same `(accountId, role)`, leaving one real profile and one silent empty duplicate. Now atomic (create-then-catch-P2002), backed by a partial unique index on non-deleted rows.
- Email, YouTube, and Facebook verification uniqueness was scoped per-role `userId` instead of per-account, so the same person switching between Creator/Freelancer roles was incorrectly blocked from reusing their own already-verified email/account under their other role.
- Cross-role shared-field sync (name/email/profile picture) in `updateProfile` looked up the sibling profile using the wrong `userId`, so it silently never ran.
- A `DELETED` user was treated identically to a `SUSPENDED` one for login purposes, permanently locking out any phone number an admin had ever deleted (e.g. cleaning up test data) — split into two distinct login checks.
- The custom OTP login path (`/send-otp` + `/verify-otp`) had no suspension check at all, unlike the Firebase login path — a suspended user with a still-valid OTP code could log in and bypass the suspension entirely.
- Instagram verification getting permanently stuck on a resumed signup: reopening the app after verifying Instagram but not finishing the rest of signup always reset to unverified client-side, and re-attempting bounced off the backend's own duplicate check with no way forward.

### Added
- Email OTP verification (`/email-verifications/start`, `/verify`) with a pluggable provider (mock/SES/Resend), currently wired to Resend.
- Daily job pruning expired `RefreshToken` rows (grows unbounded otherwise — rows are only ever marked revoked, never deleted).
