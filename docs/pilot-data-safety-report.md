# Pilot Data Safety Report

Generated: 2026-06-02 12:06 KST
Updated: 2026-06-02 12:28 KST

## Backups

- Database backup: `backups/dearlog-before-pilot-cleanup-20260602-120621.db`
- Storage backup: `backups/dearlog-storage-before-pilot-cleanup-20260602-120621.tgz`
- Orphan storage quarantine: `backups/quarantine-orphan-storage-20260602-120621`
- Post-QA orphan storage quarantine: `backups/quarantine-orphan-storage-20260602-122357`
- Post-verification-test orphan storage quarantine: `backups/quarantine-orphan-storage-20260602-122820`

## Local Database State After Cleanup

| Table | Count |
| --- | ---: |
| User | 0 |
| GuardianSeniorLink | 0 |
| Question | 0 |
| Photo | 0 |
| InterviewRecord | 0 |
| free_speech_db | 0 |

## Storage State After Cleanup

- Referenced storage keys: 0
- Active storage files: 0
- Quarantined orphan files: 109
- Post-QA quarantined files: 8
- Post-verification-test quarantined files: 5

## Mobile QA Performed After Cleanup

- Actual Chrome mobile viewport QA passed for photo upload, child approval-only question registration, parent photo-question rendering, back-button navigation, and parent answer save.
- STT health check passed: uploaded WAV audio was transcribed to Korean text through `/api/audio/transcriptions`.
- AI proxy health check passed: chat completions used FactChat `gpt-5.4-mini`; embeddings used OpenAI `text-embedding-3-small`.
- Phone-style AI conversation QA passed: the active call screen played AI questions with browser speech synthesis, generated a real AI follow-up question, and saved the answer to the database.
- QA screenshots are stored in `artifacts/pilot-mobile-qa/`.
- Final verification commands passed after the implementation: `npm run lint`, `npm run build`, and `npm run test` (45 files, 276 tests).

## Notes

- The local database only contained seeded QA accounts: `test_senior`, `test_guardian`, `other_senior`, and `other_guardian`.
- All unreferenced storage files were moved to quarantine instead of being deleted.
- Temporary `모바일QA...` users and test fixture users were removed after verification.
- Use `node scripts/pilot-data-safety-audit.mjs` to audit again.
- Use `node scripts/pilot-data-safety-audit.mjs --quarantine --timestamp=<stamp>` to quarantine newly orphaned storage files.
