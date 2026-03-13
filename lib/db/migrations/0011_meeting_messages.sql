CREATE TABLE `meeting_messages` (
  `id`           integer PRIMARY KEY AUTOINCREMENT,
  `meeting_id`   text NOT NULL REFERENCES `meetings`(`id`) ON DELETE CASCADE,
  `agent_type`   text NOT NULL,
  `content`      text NOT NULL DEFAULT '',
  `status`       text NOT NULL DEFAULT 'pending',
  `started_at`   integer,
  `completed_at` integer
);
