import { cookies } from "next/headers"

const COLLECTOR_ORIGIN =
  process.env.COLLECTOR_ORIGIN?.replace(/\/+$/, "") || "http://localhost:3001"

export async function POST(request: Request) {
  const body = await request.json()
  const { projectId } = body

  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 })
  }

  const cookieStore = await cookies()

  try {
    const res = await fetch(`${COLLECTOR_ORIGIN}/ai/analytics-insights`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieStore.toString(),
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      return Response.json(
        { error: `Collector error: ${res.status}`, detail: text },
        { status: res.status },
      )
    }

    const data = await res.json()
    return Response.json(data)
  } catch (err) {
    return Response.json(
      { error: "Failed to fetch AI analytics insights", detail: String(err) },
      { status: 502 },
    )
  }
}
