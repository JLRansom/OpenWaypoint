-- settings: key/value store for app-wide configuration
CREATE TABLE `settings` (
  `key`        text PRIMARY KEY NOT NULL,
  `value`      text NOT NULL,
  `updated_at` integer NOT NULL
);

-- Seed defaults
-- dangerouslySkipPermissions: off by default (safe for new installs)
INSERT INTO `settings` VALUES ('dangerouslySkipPermissions', 'false', unixepoch() * 1000);
