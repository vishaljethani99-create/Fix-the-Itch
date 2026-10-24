<!-- BEGIN:nextjs-agent-rules -->

## Next.js project guidance

This project uses Next.js. Before changing Next.js APIs or conventions, check the version-specific documentation installed at `node_modules/next/dist/docs/` and follow its current guidance.

<!-- END:nextjs-agent-rules -->

## Repository guidance

- Keep API keys and other secrets in local environment files; never commit them.
- Preserve existing behavior unless a requested change requires otherwise.
- Run `npm run typecheck` and `npm run build` after changing application code.
- The API accepts scenarios `hospital`, `bank`, and `office`, and languages `en`, `hi`, and `mr`.
- Sign recognition and a complete user interface are not currently included; callers supply sign labels to the API.
