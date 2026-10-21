import { canManage as canManageMembers } from '@/lib/policies'
import { useListPage } from '@/hooks/use-list-page'
import { ListControls } from '@/components/list-controls'
import type { Role, UserStatus } from '@goatcheese/teamorbit-client'
import { queryKeys } from '@/lib/query-keys'
import type { User as Item } from '@goatcheese/teamorbit-client'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { AvatarPicker } from '@/components/avatar-picker'
import { AvatarSettingsDialog } from '@/components/avatar-settings-dialog'
import { UserAvatar } from '@/components/user-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/lib/auth'
import { orbit } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/users')({
  component: UsersPage,
})

const statuses = [
  'ACTIVE',
  'INACTIVE',
  'PENDING',
  'SUSPENDED',
  'DELETED',
] as const
const roles = ['USER', 'ADMIN', 'SUPERUSER'] as const

function statusVariant(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'default' as const
    case 'PENDING':
      return 'secondary' as const
    case 'SUSPENDED':
    case 'DELETED':
      return 'destructive' as const
    default:
      return 'outline' as const
  }
}

function UsersPage() {
  const { user, refreshUser } = useAuth()
  const qc = useQueryClient()
  const canManage = canManageMembers(user)
  const pagination = useListPage()
  const { data, error, refetch, isFetching, isLoading } = useQuery({
    queryKey: [...queryKeys.users, pagination.page],
    queryFn: ({ signal }) =>
      orbit.users.list(
        { page: pagination.page, limit: pagination.limit },
        { signal },
      ),
    enabled: canManage,
  })

  const [open, setOpen] = useState(false)
  const [avatarMember, setAvatarMember] = useState<Item | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [form, setForm] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    role: 'USER' as Role,
    status: 'ACTIVE' as UserStatus,
    avatarUrl: '',
  })

  const createUser = useMutation({
    mutationFn: () =>
      orbit.users.create({
        ...form,
        email: form.email.trim() || undefined,
        avatarUrl: form.avatarUrl || null,
      }),
    onSuccess: () => {
      setForm({
        username: '',
        fullName: '',
        email: '',
        password: '',
        role: 'USER',
        status: 'ACTIVE',
        avatarUrl: '',
      })
      setOpen(false)
      qc.invalidateQueries({ queryKey: queryKeys.users })
      toast.success('User created')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      orbit.users.update(id, { role }),
    onSuccess: async (updated) => {
      if (updated.id === user?.id) await refreshUser()
      await qc.invalidateQueries({ queryKey: queryKeys.users })
      toast.success('User role updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      orbit.users.update(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users })
      toast.success('User status updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const items = data?.items ?? []
  const roleOptions =
    user?.role === 'SUPERUSER' ? roles : (['USER', 'ADMIN'] as const)

  if (!canManage) {
    return (
      <div>
        <PageHeader
          title="Users"
          description="Only Admin and Superuser can manage members."
        />
        <Empty className="border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>Access restricted</EmptyTitle>
            <EmptyDescription>
              Sign in with an Admin or Superuser account to create and manage
              users.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Create members directly, or activate PENDING self-registrations."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus data-icon="inline-start" />
                Create user
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (avatarUploading || createUser.isPending) return
                  createUser.mutate()
                }}
              >
                <DialogHeader>
                  <DialogTitle>Create user</DialogTitle>
                  <DialogDescription>
                    Admin panel create. Defaults to ACTIVE so they can sign in
                    immediately.
                  </DialogDescription>
                </DialogHeader>
                {(
                  [
                    ['username', 'Username', 'text'],
                    ['fullName', 'Full name', 'text'],
                    ['email', 'Email (optional)', 'email'],
                    ['password', 'Password', 'password'],
                  ] as const
                ).map(([key, label, type]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`create-${key}`}>{label}</Label>
                    <Input
                      id={`create-${key}`}
                      type={type}
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                      required={key !== 'email'}
                      minLength={key === 'password' ? 6 : undefined}
                    />
                  </div>
                ))}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={form.role}
                      onValueChange={(role) => {
                        if (role) setForm({ ...form, role: role as Role })
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(status) => {
                        if (status)
                          setForm({ ...form, status: status as UserStatus })
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <AvatarPicker
                  name={form.fullName}
                  value={form.avatarUrl}
                  onChange={(avatarUrl) =>
                    setForm((current) => ({ ...current, avatarUrl }))
                  }
                  onUploadingChange={setAvatarUploading}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createUser.isPending || avatarUploading}
                  >
                    {createUser.isPending ? 'Creating…' : 'Create user'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {error ? (
        <p className="mb-4 text-sm text-destructive">
          {(error as Error).message}
        </p>
      ) : null}

      <ListControls
        {...pagination}
        total={data?.total}
        error={error}
        retry={refetch}
        pending={isFetching}
      />
      {error ? null : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Empty className="border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>No users found</EmptyTitle>
            <EmptyDescription>
              Create the first member from this panel.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={u.fullName}
                        avatarUrl={u.avatarUrl}
                        size="lg"
                      />
                      <div>
                        <div className="font-medium">{u.fullName}</div>
                        <div className="text-sm text-muted-foreground">
                          @{u.username}
                        </div>
                        {user?.role === 'SUPERUSER' ||
                        u.role !== 'SUPERUSER' ||
                        u.id === user?.id ? (
                          <Button
                            variant="ghost"
                            size="xs"
                            aria-label={`Edit avatar for ${u.fullName}`}
                            onClick={() => setAvatarMember(u)}
                          >
                            Edit avatar
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{u.email ?? '—'}</TableCell>
                  <TableCell>
                    {user?.role === 'SUPERUSER' ||
                    (user?.role === 'ADMIN' && u.role === 'USER') ? (
                      <Select
                        value={u.role}
                        disabled={
                          updateRole.isPending &&
                          updateRole.variables?.id === u.id
                        }
                        onValueChange={(role) => {
                          if (role && role !== u.role)
                            updateRole.mutate({ id: u.id, role: role as Role })
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          className="w-36"
                          aria-label={`Role for ${u.fullName}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{u.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(u.status)}>
                        {u.status}
                      </Badge>
                      <Select
                        value={u.status}
                        onValueChange={(status) => {
                          if (status && status !== u.status) {
                            updateStatus.mutate({
                              id: u.id,
                              status: status as UserStatus,
                            })
                          }
                        }}
                      >
                        <SelectTrigger size="sm" className="w-36">
                          <SelectValue placeholder="Change" />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {avatarMember && (
        <AvatarSettingsDialog
          key={avatarMember.id}
          member={avatarMember}
          onClose={() => setAvatarMember(null)}
        />
      )}
    </div>
  )
}
