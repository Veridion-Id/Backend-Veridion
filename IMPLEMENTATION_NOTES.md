# Implementation Notes — Issue #39

**Issue:** [3/3] feat(pass): read + update identity (profile & verifications) under /pass
**Upstream:** https://github.com/Veridion-Id/Backend-Veridion/issues/39

## Acceptance Criteria

## Context

Final issue in the on-chain identity series. After creation (`[2/3]`), users need to **read** their identity and **update** their profile, completing the lifecycle. Depends on `[1/3]` (route group + port) and `[2/3]` (create flow).

The Passport contract exposes `update_profile(wallet, name, surnames)` and read functions `get_score` / `get_verifications`, but `update_profile` is **never exposed**, and the read endpoints currently live under the non-compliant `/platform` route.

## Scope

1. **`GET /pass/:wallet`** — aggregated identity view: `registered` flag, `name`/`surnames`, `score`, `verifications`, and derived `status` (reuse `AdminService.getStatus` logic). Cleanly handle the `NotRegistered (#2)` contract error as an empty/`registered:false` response rather than a 500.
2. **`PUT /pass/:wallet/profile`** — admin-sponsored `update_profile` build → admin-sign → submit through `StellarTransactionQueue` with retry/backoff + dead-letter, mirroring the create flow from `[2/3]`. Add `updateProfile` to `PassportPort`.
3. **Consolidate reads under `/pass`**: move `get-score`, `get-verifications`, `is-human`, `is-human-ns` from `PlatformController` (`/platform`) to `/pass` to satisfy the three-route rule. Keep thin backward-compatible aliases or document the breaking move in the README.
4. **Consistent error mapping**: centralize Passport contract error codes (`PassportError` from the bindings) into a small mapper so `AlreadyRegistered`, `NotRegistered`, `Unauthorized

---
_Delete this file before merging._