ALTER TABLE `projects` ADD `board_type` text DEFAULT 'coding' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `tester_output` text;