import { canManage as canManageMembers } from '@/lib/policies'
import { useListParams } from '@/hooks/use-list-params'
import { FilterPill, ListToolbar } from '@/components/list-toolbar'
import { ListControls } from '@/components/list-controls'
import type { Role, UserStatus } from '@goatcheese/teamorbit-client'
import { queryKeys } from '@/lib/query-keys'
import type { User as Item } from '@goatcheese/teamorbit-client'
import { createFileRoute } from '@tanstack/react-router'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  RowDeleteButton,
  TableCard,
  actionsCellClass,
  actionsHeadClass,
} from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { AvatarPicker } from '@/components/avatar-picker'
import { AvatarSettingsDialog } from '@/components/avatar-settings-dialog'
import { UserAvatar } from '@/components/user-avatar'
import { Badge } from '@/components/ui/badge'
import { PillSelect, statusVariant } from '@/components/pill-select'
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
// DELETED is only reachable through the Delete action (soft delete).
const assignableStatuses = statuses.filter((s) => s !== 'DELETED')
const sortFields = [
  { value: 'createdAt', label: 'Created' },
  { value: 'fullName', label: 'Name' },
  { value: 'username', label: 'Username' },
  { value: 'role', label: 'Role' },
  { value: 'status', label: 'Status' },
] as const
type SortField = (typeof sortFields)[number]['value']

function UsersPage() {
  const { user, refreshUser } = useAuth()
  const qc = useQueryClient()
  const canManage = canManageMembers(user)
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'ALL'>('ALL')
  const params = useListParams<SortField>('createdAt', 'desc')
  const { page, setPage, limit, q, sortBy, order } = params

  const filtered = q !== '' || roleFilter !== 'ALL' || statusFilter !== 'ALL'
  const { data, error, refetch, isFetching, isLoading } = useQuery({
    queryKey: [
      ...queryKeys.users,
      page,
      q,
      roleFilter,
      statusFilter,
      sortBy,
      order,
    ],
    queryFn: ({ signal }) =>
      orbit.users.list(
        {
          page,
          limit,
          q: q || undefined,
          role: roleFilter === 'ALL' ? undefined : roleFilter,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          sortBy,
          order,
        },
        { signal },
      ),
    enabled: canManage,
    placeholderData: keepPreviousData,
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

  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null)
  const deleteUser = useMutation({
    mutationFn: (id: string) => orbit.users.delete(id),
    onSuccess: () => {
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: queryKeys.users })
      toast.success('User deleted')
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
                    <Label htmlFor="create-role">Role</Label>
                    <Select
                      items={roleOptions.map((role) => ({
                        label: role,
                        value: role,
                      }))}
                      value={form.role}
                      onValueChange={(role) => {
                        if (role) setForm({ ...form, role: role as Role })
                      }}
                    >
                      <SelectTrigger id="create-role" className="w-full">
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
                    <Label htmlFor="create-status">Status</Label>
                    <Select
                      items={assignableStatuses.map((status) => ({
                        label: status,
                        value: status,
                      }))}
                      value={form.status}
                      onValueChange={(status) => {
                        if (status)
                          setForm({ ...form, status: status as UserStatus })
                      }}
                    >
                      <SelectTrigger id="create-status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableStatuses.map((status) => (
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

      <ListToolbar
        search={params.search}
        onSearch={params.setSearch}
        placeholder="Search name, username or email"
        filters={
          <>
            <FilterPill
              label="Role"
              value={roleFilter}
              options={[{ value: 'ALL', label: 'All' }, ...roles]}
              onChange={(v) => {
                setRoleFilter(v)
                setPage(1)
              }}
            />
            <FilterPill
              label="Status"
              value={statusFilter}
              options={[{ value: 'ALL', label: 'All' }, ...statuses]}
              onChange={(v) => {
                setStatusFilter(v)
                setPage(1)
              }}
            />
          </>
        }
        sort={{
          options: sortFields,
          value: sortBy as SortField,
          order,
          onChange: params.setSortBy,
          onToggleOrder: params.toggleOrder,
        }}
        onClear={
          filtered
            ? () => {
                params.reset()
                setRoleFilter('ALL')
                setStatusFilter('ALL')
              }
            : null
        }
      />

      <ListControls
        page={page}
        setPage={setPage}
        limit={limit}
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
              {filtered
                ? 'No members match the current filters.'
                : 'Create the first member from this panel.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className={actionsHeadClass} />
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
                      <PillSelect
                        value={u.role}
                        options={roleOptions}
                        variant="outline"
                        aria-label={`Role for ${u.fullName}`}
                        disabled={
                          updateRole.isPending &&
                          updateRole.variables?.id === u.id
                        }
                        onChange={(role) =>
                          updateRole.mutate({ id: u.id, role })
                        }
                      />
                    ) : (
                      <Badge variant="outline">{u.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <PillSelect
                      value={u.status}
                      options={assignableStatuses}
                      variant={statusVariant(u.status)}
                      aria-label={`Status for ${u.fullName}`}
                      disabled={
                        updateStatus.isPending &&
                        updateStatus.variables?.id === u.id
                      }
                      onChange={(status) =>
                        updateStatus.mutate({ id: u.id, status })
                      }
                    />
                  </TableCell>
                  <TableCell className={actionsCellClass}>
                    {u.status !== 'DELETED' &&
                    u.id !== user?.id &&
                    (user?.role === 'SUPERUSER' || u.role !== 'SUPERUSER') ? (
                      <RowDeleteButton
                        label={`Delete ${u.fullName}`}
                        onClick={() => setDeleteTarget(u)}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o && !deleteUser.isPending) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.fullName} (@{deleteTarget?.username}) will no
              longer be able to sign in and is hidden from this list. Their
              existing posts and comments are kept. You can restore them by
              filtering Status: DELETED and setting a new status.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteUser.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteUser.isPending}
              onClick={() => deleteTarget && deleteUser.mutate(deleteTarget.id)}
            >
              {deleteUser.isPending ? 'Deleting…' : 'Delete user'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
