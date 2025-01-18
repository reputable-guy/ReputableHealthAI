import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { ProtocolData } from "@/pages/protocol-designer";
import { generateProtocolInsights } from "@/lib/protocol-insights";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ProtocolPreviewProps {
  protocolData: Partial<ProtocolData>;
}

export default function ProtocolPreview({ protocolData }: ProtocolPreviewProps) {
  const { toast } = useToast();
  const [insights, setInsights] = useState<string | null>(null);

  const saveProtocol = useMutation({
    mutationFn: async (data: Partial<ProtocolData>) => {
      const res = await fetch("/api/protocols", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        throw new Error("Failed to save protocol");
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Protocol Saved",
        description: "Your study protocol has been saved successfully."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save protocol. Please try again.",
        variant: "destructive"
      });
    }
  });

  const generateInsights = useMutation({
    mutationFn: async () => {
      const insightText = await generateProtocolInsights(protocolData);
      return insightText;
    },
    onSuccess: (data) => {
      setInsights(data);
      toast({
        title: "Insights Generated",
        description: "AI-powered insights have been generated for your protocol."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate insights. Please try again.",
        variant: "destructive"
      });
    }
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{protocolData.experimentTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium">Product Information</h3>
            <p className="text-sm text-gray-600">{protocolData.productName}</p>
            {protocolData.websiteUrl && (
              <p className="text-sm text-gray-600">{protocolData.websiteUrl}</p>
            )}
          </div>

          <div>
            <h3 className="font-medium">Study Details</h3>
            <p className="text-sm text-gray-600">Category: {protocolData.studyCategory}</p>
            <p className="text-sm text-gray-600">Type: {protocolData.studyType}</p>
            <p className="text-sm text-gray-600">
              Duration: {protocolData.durationWeeks} weeks
            </p>
            <p className="text-sm text-gray-600">
              Participants: {protocolData.participantCount}
            </p>
          </div>

          <div>
            <h3 className="font-medium">Eligibility Criteria</h3>
            <ul className="list-disc list-inside text-sm text-gray-600">
              {protocolData.eligibilityCriteria?.customQuestions?.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {insights && (
        <Card>
          <CardHeader>
            <CardTitle>AI-Generated Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{insights}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <Button
          className="w-full"
          onClick={() => generateInsights.mutate()}
          disabled={generateInsights.isPending}
        >
          {generateInsights.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Insights...
            </>
          ) : (
            "Generate AI Insights"
          )}
        </Button>

        <Button
          className="w-full"
          onClick={() => saveProtocol.mutate(protocolData)}
          disabled={saveProtocol.isPending}
        >
          {saveProtocol.isPending ? "Saving..." : "Save Protocol"}
        </Button>
      </div>
    </div>
  );
}