import { configDefaults, defineConfig } from "vitest/config"
import path from "node:path"
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    globals: true,
    // Tests wait for conditions (see src/test/setup.ts); a loaded machine only needs more time, not a different test.
    testTimeout: 30000,
    env: {
      // The one base domain; every host derives from it. ("localhost" where jsdom must accept the shared-domain cookies.)
      NEXT_PUBLIC_DOMAIN: "localhost",
      NEXT_PUBLIC_SUPPORT_EMAIL: "support@example.test",
      // the owner-style value of one setting, so the markup tests see a link
      NEXT_PUBLIC_COOKIES_URL: "https://example.test/cookies",
    },
    passWithNoTests: true,
    exclude: [...configDefaults.exclude, "**/.claude/worktrees/**", "**/.worktrees/**"],
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
})
