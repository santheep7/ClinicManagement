# TODO
- [ ] Implement server-side fix for `/api/patients/history/:phone` 500.
  - Normalize phone (digits-only) before Prisma query.
  - Add detailed error logging (phone/clinicId/excludeId + stack).
  - Make mapping defensively handle nullables.
- [ ] Restart server and retest receptionist -> visit history flow.
- [ ] Verify UI receives `200` and renders history list (no 500).

