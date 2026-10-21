import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'
import { getToken } from '@/lib/session'

export const Route = createFileRoute('/register')({
  beforeLoad: () => {
    if (getToken()) throw redirect({ to: '/' })
  },
  component: RegisterPage,
})

function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
  })
  const [busy, setBusy] = useState(false)

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <img
            src="/favicon.svg"
            alt="teamorbit"
            width={48}
            height={48}
            className="mb-2 size-12"
          />
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>
            New members start as PENDING until an admin activates them on the
            Users page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              try {
                await register({
                  ...form,
                  username: form.username.trim(),
                  email: form.email.trim() || undefined,
                })
                toast.success(
                  'Registered as PENDING — ask an admin to activate you',
                )
                navigate({ to: '/login' })
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : 'Register failed',
                )
              } finally {
                setBusy(false)
              }
            }}
          >
            {(
              [
                ['username', 'Username', 'text'],
                ['fullName', 'Full name', 'text'],
                ['email', 'Email (optional)', 'email'],
                ['password', 'Password', 'password'],
              ] as const
            ).map(([key, label, type]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  required={key !== 'email'}
                  minLength={
                    key === 'username' ? 3 : key === 'password' ? 6 : undefined
                  }
                  autoComplete={
                    key === 'password'
                      ? 'new-password'
                      : key === 'username'
                        ? 'username'
                        : key === 'email'
                          ? 'email'
                          : 'name'
                  }
                />
              </div>
            ))}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Creating…' : 'Create account'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
