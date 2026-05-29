import { cookies } from "next/headers"

const normalizeOrigin = (value?: string) =>
  value?.trim().replace(/\/api\/?$/, "").replace(/\/+$/, "") || ""

const ORIGIN = normalizeOrigin(
  process.env.COLLECTOR_ORIGIN ||
    process.env.NEXT_PUBLIC_COLLECTOR_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001",
)

export function apiUrl(path: string) {
  return `/api${path}`
}

export async function serverFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T | null; error: string | null }> {
  const url = `${ORIGIN}${path}`
  const cookieStore = await cookies()
  const cookie = cookieStore.toString()

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...init?.headers,
      },
    })

    if (res.status === 401) {
      return { data: null, error: "Unauthorized" }
    }

    if (!res.ok) {
      return { data: null, error: `Request failed: ${res.status}` }
    }

    const data = (await res.json()) as T
    return { data, error: null }
  } catch (err) {
    return { data: null, error: String(err) }
  }
}
