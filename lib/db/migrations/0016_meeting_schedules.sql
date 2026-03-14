CREATE TABLE `meeting_schedules` (
  `id`              text PRIMARY KEY NOT NULL,
  `project_id`      text NOT NULL REFERENCES `projects`(`id`),
  `cron_expression` text NOT NULL,
  `next_run_at`     integer NOT NULL,
  `enabled`         integer NOT NULL DEFAULT 1,
  `created_at`      integer NOT NULL,
  `updated_at`      integer NOT NULL
);