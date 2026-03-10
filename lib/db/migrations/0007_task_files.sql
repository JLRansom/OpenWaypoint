-- task_files: stores metadata for files attached to task cards
CREATE TABLE `task_files` (
  `id`           text PRIMARY KEY NOT NULL,
  `task_id`      text NOT NULL REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  `filename`     text NOT NULL,
  `mime_type`    text NOT NULL,
  `size_bytes`   integer NOT NULL,
  `storage_path` text NOT NULL,
  `created_at`   integer NOT NULL
);
