-- Rename EventAudience.SELECTED → INVITE_ONLY (SQLite stores enums as text).
UPDATE "Event" SET "audience" = 'INVITE_ONLY' WHERE "audience" = 'SELECTED';
