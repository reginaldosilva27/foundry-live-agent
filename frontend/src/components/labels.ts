/**
 * Wire-level tokens that are rendered as-is.
 *
 * These are not prose and are not translated: `bff` is what the repository calls this process
 * everywhere else, and an MCP server label comes off the event. Keeping them out of the components
 * is what lets the no-prose test stay strict (see `i18n/strings.test.ts`).
 */
export const EXECUTOR_TAG = {
  app: 'bff',
  foundry: 'foundry',
} as const
