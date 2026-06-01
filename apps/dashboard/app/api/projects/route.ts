import { cookies } from "next/headers"

const COLLECTOR_ORIGIN =
  process.env.COLLECTOR_ORIGIN?.replace(/\/+$/, "") || "http://localhost:3001"

export async function GET() {
  const cookieStore = await cookies()

  try {
    const res = await fetch(`${COLLECTOR_ORIGIN}/projects`, {
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieStore.toString(),
      },
    })

    if (!res.ok) {
      return Response.json([], { status: res.status })
    }

    const data = await res.json()
    return Response.json(data)
  } catch {
    return Response.json([], { status: 502 })
  }
}
