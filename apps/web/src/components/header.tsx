"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MenuToggleIcon } from "@/components/ui/menu-toggle-icon"
import { createPortal } from "react-dom"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import {
  ShieldIcon,
  CodeIcon,
  ScrollTextIcon,
  LayoutDashboardIcon,
  PlugIcon,
  type LucideIcon,
} from "lucide-react"

type LinkItem = {
  title: string
  href: string
  icon: LucideIcon
  description?: string
}

const productLinks: LinkItem[] = [
  {
    title: "Code Scanner",
    href: "#",
    description: "Scan your codebase for PHI leakage risks",
    icon: CodeIcon,
  },
  {
    title: "Safe Logger",
    href: "#",
    description: "Drop-in logging that redacts PHI automatically",
    icon: ScrollTextIcon,
  },
  {
    title: "Dashboard",
    href: "#",
    description: "Monitor PHI exposure across your services",
    icon: LayoutDashboardIcon,
  },
  {
    title: "Integrations",
    href: "#",
    description: "Connect with Sentry, Datadog, and more",
    icon: PlugIcon,
  },
]

export function Header() {
  const [open, setOpen] = React.useState(false)
  const scrolled = useScroll(10)

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-transparent",
        {
          "bg-background/95 supports-[backdrop-filter]:bg-background/50 border-border backdrop-blur-lg":
            scrolled,
        }
      )}
    >
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-5">
          <a href="#" className="hover:bg-accent flex items-center gap-2 rounded-md p-2">
            <ShieldIcon className="h-5 w-5" />
            <span className="text-sm font-semibold">Medlock</span>
          </a>
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent">
                  Product
                </NavigationMenuTrigger>
                <NavigationMenuContent className="bg-background p-1 pr-1.5">
                  <ul className="bg-popover grid w-lg grid-cols-2 gap-2 rounded-md border p-2 shadow">
                    {productLinks.map((item, i) => (
                      <li key={i}>
                        <ListItem {...item} />
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuLink className="px-4" asChild>
                <a href="#" className="hover:bg-accent rounded-md p-2">
                  Pricing
                </a>
              </NavigationMenuLink>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="outline">Sign In</Button>
          <Button>Get Started</Button>
        </div>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setOpen(!open)}
          className="md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label="Toggle menu"
        >
          <MenuToggleIcon open={open} className="size-5" duration={300} />
        </Button>
      </nav>
      <MobileMenu open={open} className="flex flex-col justify-between gap-2 overflow-y-auto">
        <NavigationMenu className="max-w-full">
          <div className="flex w-full flex-col gap-y-2">
            <span className="text-sm">Product</span>
            {productLinks.map((link) => (
              <ListItem key={link.title} {...link} />
            ))}
          </div>
        </NavigationMenu>
        <div className="flex flex-col gap-2">
          <Button variant="outline" className="w-full bg-transparent">
            Sign In
          </Button>
          <Button className="w-full">Get Started</Button>
        </div>
      </MobileMenu>
    </header>
  )
}

type MobileMenuProps = React.ComponentProps<"div"> & {
  open: boolean
}

function MobileMenu({ open, children, className, ...props }: MobileMenuProps) {
  if (!open || typeof window === "undefined") return null

  return createPortal(
    <div
      id="mobile-menu"
      className={cn(
        "bg-background/95 supports-[backdrop-filter]:bg-background/50 backdrop-blur-lg",
        "fixed top-14 right-0 bottom-0 left-0 z-40 flex flex-col overflow-hidden border-y md:hidden"
      )}
    >
      <div
        data-slot={open ? "open" : "closed"}
        className={cn(
          "data-[slot=open]:animate-in data-[slot=open]:zoom-in-97 ease-out",
          "size-full p-4",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

function ListItem({
  title,
  description,
  icon: Icon,
  className,
  href,
  ...props
}: React.ComponentProps<typeof NavigationMenuLink> & LinkItem) {
  return (
    <NavigationMenuLink
      className={cn(
        "flex w-full flex-row gap-x-2 rounded-sm p-2",
        "hover:bg-accent hover:text-accent-foreground",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[active=true]:bg-accent/50 data-[active=true]:text-accent-foreground",
        className
      )}
      {...props}
      asChild
    >
      <a href={href}>
        <div className="bg-background/40 flex aspect-square size-12 items-center justify-center rounded-md border shadow-sm">
          <Icon className="text-foreground size-5" />
        </div>
        <div className="flex flex-col items-start justify-center">
          <span className="font-medium">{title}</span>
          <span className="text-muted-foreground text-xs">{description}</span>
        </div>
      </a>
    </NavigationMenuLink>
  )
}

function useScroll(threshold: number) {
  const [scrolled, setScrolled] = React.useState(false)

  const onScroll = React.useCallback(() => {
    setScrolled(window.scrollY > threshold)
  }, [threshold])

  React.useEffect(() => {
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [onScroll])

  React.useEffect(() => {
    onScroll()
  }, [onScroll])

  return scrolled
}
