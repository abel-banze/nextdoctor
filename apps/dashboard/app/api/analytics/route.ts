import { cookies } from "next/headers"

const COLLECTOR_ORIGIN =
  process.env.COLLECTOR_ORIGIN?.replace(/\/+$/, "") || "http://localhost:3001"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get("projectId")
  const period = searchParams.get("period")

  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 })
  }

  const cookieStore = await cookies()
  const qs = new URLSearchParams({ projectId })
  if (period) qs.set("period", period)

  try {
    const res = await fetch(`${COLLECTOR_ORIGIN}/analytics?${qs.toString()}`, {
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieStore.toString(),
      },
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
      { error: "Failed to fetch analytics", detail: String(err) },
      { status: 502 },
    )
  }
}
