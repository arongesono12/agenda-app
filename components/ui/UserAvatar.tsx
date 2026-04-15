'use client'

import Image from 'next/image'
import { UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name?: string | null
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_CLASSES = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-14 w-14 text-base',
  lg: 'h-20 w-20 text-xl',
  xl: 'h-28 w-28 text-3xl',
}

function getInitials(name?: string | null) {
  if (!name?.trim()) return 'U'

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U'
}

export default function UserAvatar({
  name,
  avatarUrl,
  size = 'md',
  className,
}: UserAvatarProps) {
  const initials = getInitials(name)

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-full border border-white/70 bg-gradient-to-br from-teal-500 via-cyan-500 to-slate-900 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]',
        'flex items-center justify-center font-semibold tracking-[-0.03em]',
        SIZE_CLASSES[size],
        className
      )}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name ? `Avatar de ${name}` : 'Avatar del usuario'}
          fill
          sizes="112px"
          className="object-cover"
          unoptimized={avatarUrl.startsWith('data:')}
        />
      ) : name ? (
        <span>{initials}</span>
      ) : (
        <UserRound size={size === 'xl' ? 44 : size === 'lg' ? 32 : size === 'md' ? 24 : 18} />
      )}
    </div>
  )
}
