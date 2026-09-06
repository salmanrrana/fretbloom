import { chmodSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
  stdio: 'inherit',
})
chmodSync(new URL('../.githooks/pre-commit', import.meta.url), 0o755)
