ALTER TABLE `meetings` ADD COLUMN `task_id` text REFERENCES `tasks`(`id`);
