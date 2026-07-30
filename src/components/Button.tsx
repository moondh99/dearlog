import type { ReactNode } from 'react'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  fullWidth?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  fullWidth = false,
  disabled = false,
  type = 'button',
}: ButtonProps) {
  const base = 'min-h-[51px] rounded-[14px] text-[14px] font-medium tracking-[0.04em] px-6 transition-all active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100'

  const variants = {
    primary: 'bg-[#2A2830] text-[#F7F5FB] shadow-[0_12px_28px_rgba(42,40,48,0.16)]',
    secondary: 'bg-white text-[#2A2830] border border-[#E0DBE8]',
    ghost: 'bg-transparent text-[#7A767F]',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''}`}
    >
      {children}
    </button>
  )
}
