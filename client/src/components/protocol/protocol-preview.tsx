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
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="font-medium mb-2">Product Information</h3>
            <p className="text-sm text-gray-600">{protocolData.productName}</p>
            {protocolData.websiteUrl && (
              <p className="text-sm text-gray-600">{protocolData.websiteUrl}</p>
            )}
          </div>

          {/* Study Overview */}
          <div>
            <h3 className="font-medium mb-2">Study Overview</h3>
            <p className="text-sm text-gray-600">Category: {protocolData.studyCategory}</p>
            <p className="text-sm text-gray-600">Type: {protocolData.studyType}</p>
            <p className="text-sm text-gray-600">
              Duration: {protocolData.durationWeeks} weeks
            </p>
            <p className="text-sm text-gray-600">
              Participants: {protocolData.participantCount}
            </p>
          </div>

          {/* Study Objective */}
          <div>
            <h3 className="font-medium mb-2">Study Objective</h3>
            <p className="text-sm text-gray-600">{protocolData.studyObjective}</p>
          </div>

          {/* Study Summary */}
          {protocolData.studySummary && (
            <div>
              <h3 className="font-medium mb-2">Study Summary</h3>
              <p className="text-sm text-gray-600">{protocolData.studySummary}</p>
            </div>
          )}

          {/* Target Metrics */}
          {protocolData.targetMetrics && protocolData.targetMetrics.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Target Metrics (Wearables)</h3>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {protocolData.targetMetrics.map((metric, i) => (
                  <li key={i}>{metric}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Questionnaires */}
          {protocolData.questionnaires && protocolData.questionnaires.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Validated Questionnaires</h3>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {protocolData.questionnaires.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Participant Instructions */}
          {protocolData.participantInstructions && protocolData.participantInstructions.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Participant Instructions</h3>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {protocolData.participantInstructions.map((instruction, i) => (
                  <li key={i}>{instruction}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Safety Precautions */}
          {protocolData.safetyPrecautions && protocolData.safetyPrecautions.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Safety and Precautions</h3>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {protocolData.safetyPrecautions.map((precaution, i) => (
                  <li key={i}>{precaution}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Educational Resources */}
          {protocolData.educationalResources && protocolData.educationalResources.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Educational Resources</h3>
              <div className="space-y-3">
                {protocolData.educationalResources.map((resource, i) => (
                  <div key={i} className="text-sm text-gray-600">
                    <p className="font-medium">{resource.title}</p>
                    <p>{resource.description}</p>
                    <p className="text-xs text-gray-500">Type: {resource.type}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Consent Form Sections */}
          {protocolData.consentFormSections && protocolData.consentFormSections.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Consent Form</h3>
              <div className="space-y-3">
                {protocolData.consentFormSections.map((section, i) => (
                  <div key={i} className="text-sm text-gray-600">
                    <p className="font-medium">{section.title}</p>
                    <p>{section.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Factors */}
          {protocolData.customFactors && protocolData.customFactors.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Custom Factors to Track</h3>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {protocolData.customFactors.map((factor, i) => (
                  <li key={i}>{factor}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Eligibility Criteria */}
          <div>
            <h3 className="font-medium mb-2">Eligibility Criteria</h3>

            {/* Wearable Data Requirements */}
            {protocolData.eligibilityCriteria?.wearableData && protocolData.eligibilityCriteria.wearableData.length > 0 && (
              <div className="mb-3">
                <h4 className="text-sm font-medium mb-1">Wearable Data Requirements</h4>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  {protocolData.eligibilityCriteria.wearableData.map((req, i) => (
                    <li key={i}>
                      {req.metric}: {req.condition} {req.value}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Demographics */}
            {protocolData.eligibilityCriteria?.demographics && protocolData.eligibilityCriteria.demographics.length > 0 && (
              <div className="mb-3">
                <h4 className="text-sm font-medium mb-1">Demographics</h4>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  {protocolData.eligibilityCriteria.demographics.map((demo, i) => (
                    <li key={i}>
                      {demo.category}: {demo.requirement}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Custom Questions */}
            {protocolData.eligibilityCriteria?.customQuestions && protocolData.eligibilityCriteria.customQuestions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-1">Screening Questions</h4>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  {protocolData.eligibilityCriteria.customQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
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