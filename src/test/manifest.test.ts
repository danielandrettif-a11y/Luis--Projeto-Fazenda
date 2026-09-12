/// <reference types="node" />

import { readFile } from 'node:fs/promises'
import { expect, test } from 'vitest'

test('publishes installable PWA metadata', async () => {
  const raw = await readFile('public/manifest.webmanifest', 'utf8').catch(() => '{}')
  const manifest = JSON.parse(raw)

  expect(manifest).toMatchObject({
    name: 'Gestão da Fazenda',
    short_name: 'Fazenda',
    start_url: '/',
    display: 'standalone',
    lang: 'pt-BR',
  })
})
