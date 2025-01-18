import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { ProtocolData } from "@/pages/protocol-designer";
import { generateProtocolInsights } from "@/lib/protocol-insights";
import { useState, useEffect } from "react";
import { Loader2, Info } from "lucide-react";
import ReactMarkdown from "react-markdown";
import PowerVisualization from "./power-visualization";

interface ProtocolPreviewProps {
  protocolData: Partial<ProtocolData>;
}

interface InfoTooltipProps {
  content: string;
}

function InfoTooltip({ content }: InfoTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Info className="h-4 w-4 ml-2 inline-block text-muted-foreground hover:text-foreground transition-colors" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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
          <CardTitle className="flex items-center">
            {protocolData.experimentTitle}
            <InfoTooltip content="The main title of your research study that describes its primary focus and design" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Statistical Power Analysis */}
          {protocolData.validationResults && (
            <PowerVisualization 
              power={protocolData.validationResults.statisticalPower}
              sampleSize={protocolData.participantCount || 0}
              recommendedSize={protocolData.validationResults.powerAnalysis.minimumSampleSize}
              effectSize={protocolData.validationResults.powerAnalysis.effectSize}
              confidence={protocolData.validationResults.powerAnalysis.confidence}
              powerCurve={protocolData.validationResults.powerAnalysis.powerCurve}
            />
          )}

          <div>
            <h3 className="font-medium mb-2 flex items-center">
              Product Information
              <InfoTooltip content="Details about the wellness product being studied, including name and source" />
            </h3>
            <p className="text-sm text-gray-600">{protocolData.productName}</p>
            {protocolData.websiteUrl && (
              <p className="text-sm text-gray-600">{protocolData.websiteUrl}</p>
            )}
          </div>

          <div>
            <h3 className="font-medium mb-2 flex items-center">
              Study Overview
              <InfoTooltip content="Core parameters of your study including type, duration, and participant count" />
            </h3>
            <p className="text-sm text-gray-600">Category: {protocolData.studyCategory}</p>
            <p className="text-sm text-gray-600">Type: {protocolData.studyType}</p>
            <p className="text-sm text-gray-600">Duration: {protocolData.durationWeeks} weeks</p>
            <p className="text-sm text-gray-600">Participants: {protocolData.participantCount}</p>
          </div>

          <div>
            <h3 className="font-medium mb-2 flex items-center">
              Study Objective
              <InfoTooltip content="The primary goal and expected outcomes of your research study" />
            </h3>
            <p className="text-sm text-gray-600">{protocolData.studyObjective}</p>
          </div>

          {protocolData.targetMetrics && protocolData.targetMetrics.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 flex items-center">
                Target Metrics
                <InfoTooltip content="Key measurements collected from wearable devices to track study outcomes" />
              </h3>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {protocolData.targetMetrics.map((metric, i) => (
                  <li key={i}>{metric}</li>
                ))}
              </ul>
            </div>
          )}

          {protocolData.questionnaires && protocolData.questionnaires.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 flex items-center">
                Validated Questionnaires
                <InfoTooltip content="Scientifically validated survey instruments used to collect subjective data" />
              </h3>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {protocolData.questionnaires.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {protocolData.eligibilityCriteria?.customQuestions && protocolData.eligibilityCriteria.customQuestions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1 flex items-center">
                Screening Questions
                <InfoTooltip content="Additional questions used to assess participant eligibility" />
              </h4>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {protocolData.eligibilityCriteria.customQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
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