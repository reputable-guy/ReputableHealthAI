import type { ProtocolData } from "@/pages/protocol-designer";

export async function generateProtocolInsights(protocolData: ProtocolData): Promise<string> {
  const response = await fetch("/api/protocols/insights", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(protocolData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || "Failed to generate insights");
  }

  return response.json();
}