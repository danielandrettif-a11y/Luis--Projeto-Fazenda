// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { parse } from 'smol-toml'
import { expect, test } from 'vitest'

// Catch accidental public signup and disabling the email provider needed by invited users.
test('configures local Auth for invited email users with public and anonymous signup disabled', async () => {
  const config = parse(await readFile('supabase/config.toml', 'utf8').catch(() => ''))
  expect(config.auth).toMatchObject({
    enabled: true,
    enable_signup: false,
    enable_anonymous_sign_ins: false,
    email: { enable_signup: true },
  })
})
