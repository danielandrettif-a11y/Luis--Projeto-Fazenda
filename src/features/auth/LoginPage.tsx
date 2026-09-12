import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { AuthError } from './auth-gateway'
import { useAuth } from './AuthProvider'

const loginSchema = z.object({
  email: z.string().trim().pipe(z.email('Informe um e-mail válido.')),
  password: z.string().min(1, 'Informe a senha.'),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const submit = handleSubmit(async ({ email, password }) => {
    setSubmitError(null)
    try {
      await signIn(email, password)
      navigate('/app', { replace: true })
    } catch (error) {
      setSubmitError(
        error instanceof AuthError
          ? error.message
          : 'Não foi possível entrar. Tente novamente.',
      )
    }
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        aria-labelledby="login-title"
      >
        <p className="text-sm font-semibold text-green-700">Gestão da Fazenda</p>
        <h1 id="login-title" className="mt-2 text-3xl font-bold text-slate-900">
          Entrar
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Use o acesso recebido pelo administrador da sua conta.
        </p>

        <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="email">
              E-mail
            </label>
            <input
              {...register('email')}
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            {errors.email && (
              <p id="email-error" className="mt-1 text-sm text-red-700">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="password">
              Senha
            </label>
            <input
              {...register('password')}
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            {errors.password && (
              <p id="password-error" className="mt-1 text-sm text-red-700">
                {errors.password.message}
              </p>
            )}
          </div>

          {submitError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-green-800 px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  )
}
