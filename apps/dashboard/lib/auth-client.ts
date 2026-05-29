import { createAuthClient } from "better-auth/client"

const normalizeBaseURL = (value?: string) =>
  value?.trim().replace(/\/+$/, "").replace(/\/api\/?$/, "") || ""

const collectorBaseURL = normalizeBaseURL(process.env.NEXT_PUBLIC_COLLECTOR_URL)
const apiBaseURL = normalizeBaseURL(process.env.NEXT_PUBLIC_API_URL)

export const authClient = createAuthClient({
  baseURL: collectorBaseURL ? `${collectorBaseURL}/auth` : apiBaseURL ? `${apiBaseURL}/auth` : "/api/auth",
})
