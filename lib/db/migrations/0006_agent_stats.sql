-- agents: JSON blob for live/ephemeral stats (broadcast via SSE while agent runs)
ALTER TABLE `agents` ADD `stats` text;

-- task_runs: individual columns for persistent per-run token/cost stats
ALTER TABLE `task_runs` ADD `input_tokens` integer;
ALTER TABLE `task_runs` ADD `output_tokens` integer;
ALTER TABLE `task_runs` ADD `num_turns` integer;
ALTER TABLE `task_runs` ADD `cost_usd` real;
ALTER TABLE `task_runs` ADD `model` text;
