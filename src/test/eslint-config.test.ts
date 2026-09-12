// @vitest-environment node
import { ESLint } from 'eslint'
import { expect, test } from 'vitest'

// Omitting JS config coverage silently allows undefined variables into build tooling.
test.each(['js', 'mjs', 'cjs'])('lints %s configuration with Node globals and no ignored-file warning', async (extension) => {
  const eslint = new ESLint()
  const [invalid] = await eslint.lintText('missingConfiguration()', { filePath: `probe.config.${extension}` })
  expect(invalid!.messages).toMatchObject([{ ruleId: 'no-undef', severity: 2 }])
  const source = extension === 'cjs'
    ? 'module.exports = { mode: process.env.NODE_ENV }'
    : 'export default { mode: process.env.NODE_ENV }'
  const [valid] = await eslint.lintText(source, { filePath: `probe.config.${extension}` })
  expect(valid!.messages).toEqual([])
})
