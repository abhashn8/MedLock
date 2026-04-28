"use client"

import { HsDropdownMenu, HsDropdownMenuItem } from "@/components/hipaa-shield/HsDropdownMenu"
import { cn } from "@/lib/utils"

export type HsUserMenuProps = {
  name: string
  role: string
  initials: string
  onProfile?: () => void
  onSettings?: () => void
  onLogout: () => void
  className?: string
}

/**
 * Avatar trigger with account actions.
 */
export function HsUserMenu({
  name,
  role,
  initials,
  onProfile,
  onSettings,
  onLogout,
  className,
}: HsUserMenuProps) {
  return (
    <HsDropdownMenu
      align="right"
      trigger={
        <span
          className={cn(
            "flex size-8 cursor-pointer items-center justify-center rounded-full bg-hs-fill text-hs-caption font-medium text-hs-muted ring-1 ring-hs-border",
            className,
          )}
          title={name}
        >
          {initials}
        </span>
      }
    >
      <div className="border-b border-hs-border px-4 py-3">
        <p className="text-hs-body font-medium text-hs-text">{name}</p>
        <p className="text-hs-caption font-normal text-hs-muted">{role}</p>
      </div>
      <HsDropdownMenuItem type="button" onClick={onProfile}>
        Profile
      </HsDropdownMenuItem>
      <HsDropdownMenuItem type="button" onClick={onSettings}>
        Settings
      </HsDropdownMenuItem>
      <HsDropdownMenuItem type="button" onClick={onLogout}>
        Log out
      </HsDropdownMenuItem>
    </HsDropdownMenu>
  )
}
