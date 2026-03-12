-- settings: key/value store for app-wide configuration
-- Default value for each key is handled in application code (no seed row needed):
--   getSetting(key) ?? 'false'  →  safe default when row is absent
CREATE TABLE `settings` (
  `key`        text PRIMARY KEY NOT NULL,
  `value`      text NOT NULL,
  `updated_at` integer NOT NULL
);
