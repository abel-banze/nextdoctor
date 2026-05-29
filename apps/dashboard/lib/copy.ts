import { toast } from "sonner"

export async function copyToClipboard(text: string, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(label)
  } catch {
    toast.error("Failed to copy")
  }
}
