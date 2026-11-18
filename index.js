/**
 * Chat preset tool lock.
 *
 * A preset only decides which tools it mounts; tools that profile-level plugins
 * register are inherited by every Agent through the scope chain. This row masks
 * those inherited global tools for Chat sessions and keeps a monotonic guard so
 * a tool registered after activation still cannot run.
 *
 * `ctx.tools.restrict()` needs exact global tool names, so the mask is rebuilt
 * whenever the tool registry changes; the guard needs no names and stays the
 * backstop. The preset's own scoped registrations are exempt from a restriction,
 * so the one tool this mode mounts — `web_search` — is listed as the guard's
 * only exception.
 */

/** Reserved PTC transport name; the registry rejects it in a restriction. */
const RUN_CODE = 'run_code'

/** The only tool the Chat preset mounts: `@deepseek-ai/dsh-tool-web` search. */
const ALLOWED = new Set(['web_search'])

const DENIAL = 'This is the Chat mode: web_search is the only tool here. Answer from knowledge and reasoning.'

export const inject = ['tools']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx - preset-scoped context
 */
export function apply(ctx) {
  const tools = ctx.tools
  let restriction
  let masked = new Set()
  let disposed = false

  const mask = () => {
    if (disposed) return
    const names = [...new Set(
      tools.definitions()
        .map(definition => definition.name)
        .filter(name => name !== RUN_CODE),
    )].sort()
    if (names.length === masked.size && names.every(name => masked.has(name))) return
    // Claim the new set first: `restrict()` itself emits `tools/change`, and a
    // reentrant call must see this set as already applied instead of looping.
    const previousMasked = masked
    masked = new Set(names)
    let next
    try {
      next = names.length === 0 ? undefined : tools.restrict({ deny: names })
    } catch {
      // A name went unknown between reading and restricting; the next
      // `tools/change` retries, and the guard already blocks execution.
      masked = previousMasked
      return
    }
    const previous = restriction
    restriction = next
    previous?.()
  }

  tools.guard(execution => ALLOWED.has(execution.name) ? undefined : DENIAL)
  ctx.on('tools/change', mask)
  mask()

  ctx.effect(() => () => {
    disposed = true
    restriction?.()
    restriction = undefined
  })
}