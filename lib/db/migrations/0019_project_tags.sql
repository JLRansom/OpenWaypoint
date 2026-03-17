CREATE TABLE `project_tags` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `projects`(`id`),
  `name` text NOT NULL,
  `color` text NOT NULL DEFAULT '#6272a4',
  `created_at` integer NOT NULL
);
