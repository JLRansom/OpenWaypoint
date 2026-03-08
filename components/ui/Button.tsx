import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-dracula-purple text-dracula-darker border border-dracula-purple hover:bg-dracula-purple/90',
  secondary: 'bg-dracula-dark text-dracula-blue border border-dracula-dark/80 hover:text-dracula-light hover:border-dracula-purple/40',
  ghost: 'text-dracula-cyan border border-dracula-cyan/30 bg-transparent hover:bg-dracula-cyan/10 hover:text-dracula-light',
  danger: 'text-dracula-red border border-dracula-red/30 bg-transparent hover:bg-dracula-red/10',
}

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'text-xs px-3 py-1',
  md: 'text-sm px-4 py-1.5',
}

export function Button({ variant = 'primary', size = 'sm', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  )
}
