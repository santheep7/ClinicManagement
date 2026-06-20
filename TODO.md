# TODO

## Plan (lint + build correctness)
- [ ] Remove/adjust `setState` calls that occur synchronously inside `useEffect` bodies in `client/app/doctor/page.tsx` to satisfy `react-hooks/set-state-in-effect`.
- [ ] Remove `any` typings in `client/app/doctor/page.tsx` to satisfy `@typescript-eslint/no-explicit-any`.
- [ ] Rerun `npm --prefix client run lint` to verify remaining issues.
- [ ] If lint errors remain in other files (`client/app/clinic-admin/page.tsx`, `client/app/dashboard/page.tsx`, `client/app/page.tsx`, `client/app/receptionist/page.tsx`), apply similar fixes until lint passes.
- [ ] Run `npm --prefix client test` (or next build command) if available, to confirm build.

