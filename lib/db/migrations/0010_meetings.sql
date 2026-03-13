CREATE TABLE `meetings` (
  `id`         text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `projects`(`id`),
  `topic`      text NOT NULL,
  `status`     text NOT NULL DEFAULT 'setup',
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
