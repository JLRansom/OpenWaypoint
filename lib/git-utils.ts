import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Run a git command and return trimmed stdout.
 * Throws on non-zero exit.
 */
async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd })
  return stdout.trim()
}

/**
 * Given a worktree directory, parse `git worktree list --porcelain` to find
 * the path of the main (bare) worktree — i.e. the actual repo root.
 */
async function getMainWorktreePath(worktreeDir: string): Promise<string> {
  const output = await git(worktreeDir, ['worktree', 'list', '--porcelain'])
  // First block is always the main worktree
  const firstLine = output.split('\n')[0]
  // Format: "worktree /absolute/path"
  const match = firstLine.match(/^worktree\s+(.+)$/)
  if (!match) throw new Error(`Could not parse main worktree path from: ${firstLine}`)
  return match[1]
}

/**
 * Merge a worktree branch into master/main and clean up the worktree.
 *
 * Steps:
 *   1. Resolve the main repo root from the worktree directory.
 *   2. Detect the current branch inside the worktree.
 *   3. If it is already main/master, skip (nothing to merge).
 *   4. From the main worktree, merge with --no-ff.
 *   5. Delete the branch and remove the worktree.
 *
 * This is best-effort — callers should wrap in try/catch.
 */
export async function mergeWorktreeBranch(
  worktreeDir: string,
  taskTitle: string
): Promise<void> {
  const mainWorktree = await getMainWorktreePath(worktreeDir)
  const branch = await git(worktreeDir, ['rev-parse', '--abbrev-ref', 'HEAD'])

  if (branch === 'main' || branch === 'master') {
    // Already on default branch — nothing to merge
    console.log(`[git-utils] Worktree is on ${branch}, skipping merge.`)
    return
  }

  console.log(`[git-utils] Merging branch "${branch}" into main worktree at ${mainWorktree}`)

  // Merge from the main worktree
  await git(mainWorktree, [
    'merge',
    branch,
    '--no-ff',
    '-m',
    `Merge ${branch} for task: ${taskTitle}`,
  ])

  // Delete the branch
  await git(mainWorktree, ['branch', '-d', branch])

  // Remove the worktree
  await git(mainWorktree, ['worktree', 'remove', '--force', worktreeDir])

  console.log(`[git-utils] Worktree "${worktreeDir}" merged and removed.`)
}
