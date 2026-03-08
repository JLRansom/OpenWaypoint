CREATE TABLE `task_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`task_title` text NOT NULL,
	`project_id` text NOT NULL,
	`project_name` text NOT NULL,
	`agent_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`output` text DEFAULT '' NOT NULL,
	`error` text,
	`started_at` integer NOT NULL,
	`completed_at` integer NOT NULL
);
