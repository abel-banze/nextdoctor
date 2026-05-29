import { createAuthClient } from "better-auth/client"

const apiBaseURL = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "")

export const authClient = createAuthClient({
  baseURL: apiBaseURL ? `${apiBaseURL}/auth` : "/api/auth",
})
