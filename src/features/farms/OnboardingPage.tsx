import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import type { FarmGateway } from './farm-gateway'
import { bootstrapAccountSchema } from './farm-schemas'

type OnboardingValues = z.infer<typeof bootstrapAccountSchema>

export function OnboardingPage({ gateway }: { gateway: FarmGateway }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingValues>({
    resolver: zodResolver(bootstrapAccountSchema),
    defaultValues: { accountName: '', firstFarmName: '' },
  })

  const submit = handleSubmit(async (values) => {
    setSubmitError(null)
    try {
      await gateway.bootstrapAccount(values)
      queryClient.removeQueries({ queryKey: ['farms'], exact: true })
      navigate('/app', { replace: true })
    } catch {
      setSubmitError('Não foi possível criar a conta. Tente novamente.')
    }
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        aria-labelledby="onboarding-title"
      >
        <p className="text-sm font-semibold text-green-700">Gestão da Fazenda</p>
        <h1 id="onboarding-title" className="mt-2 text-3xl font-bold text-slate-900">
          Configure sua conta
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Informe os dados iniciais para começar a organizar sua fazenda.
        </p>

        <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="account-name">
              Nome da conta
            </label>
            <input
              {...register('accountName')}
              id="account-name"
              autoComplete="organization"
              aria-invalid={Boolean(errors.accountName)}
              aria-describedby={errors.accountName ? 'account-name-error' : undefined}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            {errors.accountName && (
              <p id="account-name-error" className="mt-1 text-sm text-red-700">
                {errors.accountName.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="farm-name">
              Nome da fazenda
            </label>
            <input
              {...register('firstFarmName')}
              id="farm-name"
              autoComplete="off"
              aria-invalid={Boolean(errors.firstFarmName)}
              aria-describedby={errors.firstFarmName ? 'farm-name-error' : undefined}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            {errors.firstFarmName && (
              <p id="farm-name-error" className="mt-1 text-sm text-red-700">
                {errors.firstFarmName.message}
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
            {isSubmitting ? 'Criando…' : 'Criar conta'}
          </button>
        </form>
      </section>
    </main>
  )
}
