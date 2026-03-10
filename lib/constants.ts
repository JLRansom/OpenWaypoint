/** Tailwind class pairs for agent role badges (text + background). */
export const ROLE_COLORS: Record<string, string> = {
  researcher: 'text-dracula-cyan bg-dracula-cyan/10',
  coder: 'text-dracula-green bg-dracula-green/10',
  'senior-coder': 'text-dracula-orange bg-dracula-orange/10',
  writer: 'text-dracula-purple bg-dracula-purple/10',
  tester: 'text-dracula-pink bg-dracula-pink/10',
}

/** Default fallback classes when a role has no entry in ROLE_COLORS. */
export const ROLE_COLOR_FALLBACK = 'text-dracula-light bg-dracula-dark'

/** Hex color values for each agent role — for use in SVG/canvas contexts (e.g. Recharts) where Tailwind classes don't apply. */
export const ROLE_HEX: Record<string, string> = {
  researcher:    '#8be9fd', // cyan
  coder:         '#50fa7b', // green
  'senior-coder':'#ffb86c', // orange
  writer:        '#bd93f9', // purple
  tester:        '#ff79c6', // pink
}

/** Fallback hex color for unknown roles. */
export const ROLE_HEX_FALLBACK = '#6272a4'

/** Ordered column definitions per board type — used for bulk "Move to" dropdown. */
export const BOARD_COLUMNS: Record<string, { value: string; label: string }[]> = {
  coding: [
    { value: 'backlog',             label: 'Backlog' },
    { value: 'planning',            label: 'Planning' },
    { value: 'in-progress',         label: 'In Progress' },
    { value: 'review',              label: 'Review' },
    { value: 'testing',             label: 'Testing' },
    { value: 'changes-requested',   label: 'Changes Requested' },
    { value: 'done',                label: 'Done' },
  ],
  research: [
    { value: 'backlog',     label: 'Backlog' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'done',        label: 'Done' },
  ],
  general: [
    { value: 'backlog',     label: 'To Do' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'done',        label: 'Done' },
  ],
}
