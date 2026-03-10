-- agents: JSON blob for live/ephemeral stats (broadcast via SSE while agent runs)
ALTER TABLE `agents` ADD `stats` text;
--> statement-breakpoint
-- task_runs: individual columns for persistent per-run token/cost stats
ALTER TABLE `task_runs` ADD `input_tokens` integer;
--> statement-breakpoint
ALTER TABLE `task_runs` ADD `output_tokens` integer;
--> statement-breakpoint
ALTER TABLE `task_runs` ADD `num_turns` integer;
--> statement-breakpoint
ALTER TABLE `task_runs` ADD `cost_usd` real;
--> statement-breakpoint
ALTER TABLE `task_runs` ADD `model` text;
