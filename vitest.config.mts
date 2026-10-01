import { configDefaults, defineConfig } from "vitest/config"
import path from "node:path"
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    globals: true,
    env: {
      NEXT_PUBLIC_MAIN_HOST: "example.test",
      // NEXT_PUBLIC_API_HOST stays unset: API calls are same-origin (relative) in tests.
      NEXT_PUBLIC_ID_HOST: "id.example.test",
      NEXT_PUBLIC_ADMIN_HOST: "admin.example.test",
      NEXT_PUBLIC_EXERCISES_HOST: "exercises.example.test",
      // localhost so the shared-domain cookies are accepted by jsdom.
      NEXT_PUBLIC_EVENT_DOMAIN: "localhost",
    },
    passWithNoTests: true,
    exclude: [...configDefaults.exclude, "**/.claude/worktrees/**", "**/.worktrees/**"],
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
})
