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
