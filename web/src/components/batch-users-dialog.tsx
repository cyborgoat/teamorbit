import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { orbit } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type BatchResult = Awaited<ReturnType<typeof orbit.users.createBatch>>
const batchLimit = 50
const emptyUser = { username: '', fullName: '', email: '' }
const userFields = [
  ['username', 'Username'],
  ['fullName', 'Full name'],
  ['email', 'Email (optional)'],
] as const
const manualColumns =
  'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1.75rem] gap-x-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_1.75rem]'
type DraftUser = typeof emptyUser
type InputMode = 'csv' | 'form'

function validateRow(row: number, { username, fullName, email }: DraftUser) {
  username = username.trim()
  fullName = fullName.trim()
  email = email.trim()
  const errors = []
  if ([...username].length < 3)
    errors.push('Username needs at least 3 characters')
  if (!fullName) errors.push('Full name is required')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push('Enter a valid email address')
  return { row, username, fullName, email, errors }
}

function parseCsv(text: string) {
  const { data, errors } = Papa.parse<string[]>(text, { delimiter: ',' })
  const records = data
    .map((fields, index) => ({ fields, row: index + 1 }))
    .filter(({ fields }) => fields.length !== 1 || fields[0].trim())
  const first = records[0]?.fields.map((field) =>
    field.trim().toLowerCase().replace(/[ _]/g, ''),
  )
  if (
    first?.[0] === 'username' &&
    first[1] === 'fullname' &&
    (first.length === 2 || (first.length === 3 && first[2] === 'email'))
  ) {
    records.shift()
  }
  const rows = records.map(({ fields, row }) => {
    const [username = '', fullName = '', email = '', ...extra] = fields
    const entry = validateRow(row, { username, fullName, email })
    if (extra.length) entry.errors.push('Use up to 3 columns')
    return entry
  })
  const error = errors[0]
  return {
    rows,
    error: error ? `CSV row ${(error.row ?? 0) + 1}. ${error.message}` : '',
  }
}

export function BatchUsersDialog() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<InputMode>('csv')
  const [input, setInput] = useState('')
  const [drafts, setDrafts] = useState([{ id: 1, ...emptyUser }])
  const [readingFile, setReadingFile] = useState(false)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<BatchResult | null>(null)
  const [error, setError] = useState('')
  const busy = pending || readingFile
  const csv = mode === 'csv' ? parseCsv(input) : null
  const formRows = drafts.map((draft, index) => validateRow(index + 1, draft))
  const rows = csv?.rows ?? formRows
  const overLimit = rows.length > batchLimit
  const canSubmit =
    rows.length > 0 &&
    !overLimit &&
    !csv?.error &&
    rows.every((row) => !row.errors.length)
  const credentials = result?.created.length
    ? Papa.unparse(
        result.created.map(({ user, password }) => [user.username, password]),
        { newline: '\n' },
      )
    : ''

  function changeOpen(next: boolean) {
    if (busy) return
    setOpen(next)
    if (!next) {
      setInput('')
      setDrafts([{ id: 1, ...emptyUser }])
      setMode('csv')
      setResult(null)
      setError('')
    }
  }

  async function readCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setReadingFile(true)
    setError('')
    try {
      setInput(await file.text())
    } catch {
      setError('Could not read the CSV file')
    } finally {
      setReadingFile(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit || busy || result) return
    setPending(true)
    setError('')
    try {
      const response = await orbit.users.createBatch({
        users: rows.map(({ username, fullName, email }) => ({
          username,
          fullName,
          email: email || undefined,
        })),
      })
      setResult(response)
      void queryClient.invalidateQueries({ queryKey: queryKeys.users })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not create users',
      )
    } finally {
      setPending(false)
    }
  }

  async function copyCredentials() {
    if (!credentials) return
    try {
      await navigator.clipboard.writeText(credentials)
      toast.success('Credentials copied')
    } catch {
      toast.error('Select and copy the credentials from the text box')
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">Batch create</Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>
            {result ? 'Batch results' : 'Batch create users'}
          </DialogTitle>
          <DialogDescription>
            {result
              ? `${result.created.length} created, ${result.skipped.length} skipped.`
              : `Create up to ${batchLimit} users. Each user needs a username and full name.`}
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <>
            {credentials && (
              <div className="space-y-2">
                <Label htmlFor="batch-credentials">
                  Usernames and passwords
                </Label>
                <p
                  id="batch-credentials-help"
                  className="text-sm text-muted-foreground"
                >
                  Copy the CSV before closing. The columns are username and
                  password.
                </p>
                <Textarea
                  id="batch-credentials"
                  aria-describedby="batch-credentials-help"
                  className="font-mono"
                  rows={5}
                  readOnly
                  value={credentials}
                />
              </div>
            )}
            {result.skipped.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">Skipped rows</h3>
                <ul className="max-h-40 space-y-1 overflow-y-auto break-words text-muted-foreground">
                  {result.skipped.map(({ row, username, field }) => (
                    <li key={row}>
                      Row {rows[row - 1]?.row ?? row} ({username}) —{' '}
                      {field === 'email' ? 'Email' : 'Username'} already in use
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => changeOpen(false)}>
                Done
              </Button>
              {credentials && (
                <Button onClick={copyCredentials}>Copy credentials</Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <form className="space-y-3" onSubmit={submit}>
            <Tabs
              value={mode}
              onValueChange={(value) => {
                if (value === 'csv' || value === 'form') {
                  setMode(value)
                  setError('')
                }
              }}
            >
              <TabsList variant="line" aria-label="Batch entry method">
                <TabsTrigger value="csv" disabled={busy}>
                  CSV
                </TabsTrigger>
                <TabsTrigger value="form" disabled={busy}>
                  Manual entry
                </TabsTrigger>
              </TabsList>
              <TabsContent value="csv" className="space-y-3 pt-1">
                <div className="space-y-2">
                  <Label htmlFor="batch-users-file">Upload CSV</Label>
                  <Input
                    id="batch-users-file"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={readCsv}
                    disabled={busy}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batch-users-input">Paste or edit CSV</Label>
                  <p id="batch-users-format" className="text-muted-foreground">
                    Use username, full name, and optional email in that order.
                    The header row is optional.
                  </p>
                  <Textarea
                    id="batch-users-input"
                    aria-describedby="batch-users-format"
                    className="font-mono"
                    rows={4}
                    value={input}
                    disabled={busy}
                    spellCheck={false}
                    placeholder={
                      'username,fullName,email\nalex,Alex Rivera,alex@example.com\njamie,Jamie Chen'
                    }
                    onChange={(event) => {
                      setInput(event.target.value)
                      setError('')
                    }}
                  />
                </div>
                {csv?.error && (
                  <p role="alert" className="text-destructive">
                    {csv.error}
                  </p>
                )}
                {rows.length > 0 && (
                  <div className="max-h-56 overflow-auto">
                    <Table aria-label="Batch preview">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Full name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Validation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.slice(0, batchLimit).map((row) => (
                          <TableRow key={row.row}>
                            <TableCell>{row.row}</TableCell>
                            <TableCell>{row.username}</TableCell>
                            <TableCell>{row.fullName}</TableCell>
                            <TableCell>{row.email}</TableCell>
                            <TableCell className="text-destructive">
                              {row.errors.join('. ')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="form" className="space-y-2 pt-1">
                <div className="max-h-[45vh] space-y-2 overflow-y-auto p-1">
                  <div
                    aria-hidden="true"
                    className={cn(
                      manualColumns,
                      'hidden text-xs font-medium text-muted-foreground sm:grid',
                    )}
                  >
                    {userFields.map(([field, label]) => (
                      <span key={field}>{label}</span>
                    ))}
                  </div>
                  {drafts.map((draft, index) => (
                    <fieldset
                      key={draft.id}
                      className="min-w-0 space-y-1"
                      disabled={busy}
                    >
                      <legend className="sr-only">Account {index + 1}</legend>
                      <div className={cn(manualColumns, 'items-end gap-y-1.5')}>
                        {userFields.map(([field, label]) => {
                          const id = `batch-account-${draft.id}-${field}`
                          return (
                            <div
                              key={field}
                              className={cn(
                                'min-w-0 space-y-1',
                                field === 'email' && 'col-span-2 sm:col-span-1',
                              )}
                            >
                              <Label
                                htmlFor={id}
                                className="text-xs text-muted-foreground sm:sr-only"
                              >
                                {label}
                              </Label>
                              <Input
                                id={id}
                                className="h-8 rounded-md border-0 bg-muted/70 px-2 focus-visible:ring-2"
                                type={field === 'email' ? 'email' : 'text'}
                                required={field !== 'email'}
                                value={draft[field]}
                                onChange={(event) => {
                                  const value = event.target.value
                                  setError('')
                                  setDrafts((current) =>
                                    current.map((user) =>
                                      user.id === draft.id
                                        ? { ...user, [field]: value }
                                        : user,
                                    ),
                                  )
                                }}
                              />
                            </div>
                          )
                        })}
                        {drafts.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="col-start-3 row-start-1 self-end text-muted-foreground sm:col-start-4"
                            aria-label={`Remove account ${index + 1}`}
                            onClick={() =>
                              setDrafts((current) =>
                                current.filter((user) => user.id !== draft.id),
                              )
                            }
                          >
                            <X />
                          </Button>
                        )}
                      </div>
                      {(draft.username || draft.fullName || draft.email) &&
                        formRows[index].errors.length > 0 && (
                          <p className="text-xs text-destructive">
                            {formRows[index].errors.join('. ')}
                          </p>
                        )}
                    </fieldset>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  disabled={busy || drafts.length >= batchLimit}
                  onClick={() =>
                    setDrafts((current) => [
                      ...current,
                      { id: current[current.length - 1].id + 1, ...emptyUser },
                    ])
                  }
                >
                  <Plus data-icon="inline-start" />
                  Add account
                </Button>
              </TabsContent>
            </Tabs>
            {overLimit && (
              <p role="alert" className="text-destructive">
                Use at most {batchLimit} rows per batch.
              </p>
            )}
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <DialogFooter className="-mb-2 border-0 bg-transparent px-4 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => changeOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busy || !canSubmit}>
                {pending ? 'Creating…' : 'Create users'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
