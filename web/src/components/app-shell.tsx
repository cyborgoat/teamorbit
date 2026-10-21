import { queryKeys } from '@/lib/query-keys'
import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  CalendarDays,
  FileText,
  Home,
  ImageUp,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Newspaper,
  Settings,
  Users,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useNotificationsSocket } from '@/hooks/use-notifications-socket'
import { UserAvatar } from '@/components/user-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import { orbit } from '@/lib/api'

const navItems = [
  { to: '/', label: 'Home', icon: Home, exact: true },
  {
    to: '/announcements',
    label: 'Announcements',
    icon: Megaphone,
    exact: false,
  },
  { to: '/events', label: 'Events', icon: CalendarDays, exact: false },
  { to: '/news', label: 'News', icon: Newspaper, exact: false },
  { to: '/blog', label: 'Blog', icon: FileText, exact: false },
  { to: '/forum', label: 'Forum', icon: MessageSquare, exact: false },
  { to: '/users', label: 'Users', icon: Users, exact: false },
  { to: '/notifications', label: 'Notifications', icon: Bell, exact: false },
  { to: '/uploads', label: 'Uploads', icon: ImageUp, exact: false },
  { to: '/settings', label: 'Settings', icon: Settings, exact: false },
] as const

function NavLinks({
  onNavigate,
  unread,
}: {
  onNavigate?: () => void
  unread: number
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const active = item.exact
          ? pathname === item.to
          : pathname === item.to || pathname.startsWith(`${item.to}/`)
        const Icon = item.icon
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.to === '/notifications' && unread > 0 ? (
              <Badge variant="secondary">{unread}</Badge>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout, token } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => orbit.notifications.list(),
    enabled: !!token,
    refetchInterval: 30_000,
  })
  const unread = data?.items.filter((n) => !n.read).length ?? 0

  function handleLogout() {
    logout()
    qc.clear()
    onNavigate?.()
    void navigate({ to: '/login' })
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div>
        <p className="text-lg font-semibold tracking-tight">teamorbit</p>
        <p className="text-xs text-muted-foreground">Team administration</p>
      </div>
      <Separator />
      <div className="flex-1 overflow-y-auto">
        <NavLinks onNavigate={onNavigate} unread={unread} />
      </div>
      <Separator />
      <div className="flex items-center gap-3">
        <Link
          to="/settings"
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 -m-1 transition-colors hover:bg-sidebar-accent/70"
        >
          <UserAvatar
            name={user?.fullName ?? 'User'}
            avatarUrl={user?.avatarUrl}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.role}
            </p>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Log out"
          onClick={handleLogout}
        >
          <LogOut />
        </Button>
      </div>
    </div>
  )
}

export function AppShell() {
  const { user, loading } = useAuth()
  useNotificationsSocket()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-muted/40">
        <Outlet />
        <Toaster />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:block">
        <SidebarBody />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-3 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <SidebarBody />
            </SheetContent>
          </Sheet>
          <span className="font-semibold">teamorbit</span>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  )
}
