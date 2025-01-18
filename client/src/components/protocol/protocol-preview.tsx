import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { ProtocolData, ValidationResult } from "@/pages/protocol-designer";
import { generateProtocolInsights } from "@/lib/protocol-insights";
import { useState } from "react";
import { Loader2, Info, Shield, AlertTriangle, CheckCircle, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { validateStudyDesign } from "@/lib/study-validation";
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
  const [validationResults, setValidationResults] = useState<ValidationResult | null>(null);

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

  const runValidation = useMutation({
    mutationFn: async () => {
      const results = await validateStudyDesign(protocolData);
      return results;
    },
    onSuccess: (data) => {
      setValidationResults(data);
      toast({
        title: data.isValid ? "Validation Passed" : "Validation Issues Found",
        description: data.isValid
          ? "Your study design meets all validation criteria."
          : `Found ${data.errors.length} issues that need attention.`,
        variant: data.isValid ? "default" : "destructive"
      });
    },
    onError: () => {
      toast({
        title: "Validation Error",
        description: "Failed to validate study design. Please try again.",
        variant: "destructive"
      });
    }
  });

  const ValidationResults = () => {
    if (!validationResults) return null;

    return (
      <Card className="mb-6 border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Power Analysis Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Power Analysis Visualization */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <PowerVisualization
                power={validationResults.statisticalPower}
                sampleSize={protocolData.participantCount || 0}
                recommendedSize={validationResults.minimumSampleSize}
              />
            </div>

            {/* Sample Size Analysis */}
            <div>
              <h3 className="font-medium mb-2">Sample Size Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Minimum recommended: {validationResults.minimumSampleSize} participants
                {protocolData.participantCount && (
                  <span className={`ml-2 ${
                    protocolData.participantCount >= validationResults.minimumSampleSize
                      ? "text-green-600"
                      : "text-red-600"
                  }`}>
                    Current: {protocolData.participantCount}
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title Section */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {protocolData.experimentTitle || "Study Protocol"}
        </h1>
        <p className="text-lg text-muted-foreground">
          {protocolData.studyCategory} - {protocolData.studyType}
        </p>
      </div>

      {/* Quick Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Duration</p>
              <p className="text-2xl font-semibold">{protocolData.durationWeeks} weeks</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Participants</p>
              <p className="text-2xl font-semibold">{protocolData.participantCount}</p>
            </div>
          </CardContent>
        </Card>
        {protocolData.studyGoal && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Study Goal</p>
                <p className="text-2xl font-semibold capitalize">{protocolData.studyGoal}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Validation Results Card */}
      {validationResults && <ValidationResults />}

      {/* Study Details Section */}
      <Card>
        <CardHeader>
          <CardTitle>Study Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">

            {/* Objective and Summary */}
            <div>
              <h3 className="font-medium mb-2">Study Objective</h3>
              <p className="text-sm text-muted-foreground">{protocolData.studyObjective}</p>
            </div>
            {protocolData.studySummary && (
              <div>
                <h3 className="font-medium mb-2">Summary</h3>
                <p className="text-sm text-muted-foreground">{protocolData.studySummary}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Collection Section */}
      <Collapsible>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle>Data Collection</CardTitle>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {protocolData.targetMetrics && protocolData.targetMetrics.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Target Metrics</h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {protocolData.targetMetrics.map((metric, i) => (
                        <li key={i} className="text-muted-foreground">{metric}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {protocolData.questionnaires && protocolData.questionnaires.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Questionnaires</h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {protocolData.questionnaires.map((q, i) => (
                        <li key={i} className="text-muted-foreground">{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Participant Guidelines Section */}
      <Collapsible>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle>Participant Guidelines</CardTitle>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {protocolData.participantInstructions && (
                <ul className="list-disc list-inside text-sm space-y-1">
                  {protocolData.participantInstructions.map((instruction, i) => (
                    <li key={i} className="text-muted-foreground">{instruction}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Safety Section */}
      <Collapsible>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle>Safety and Resources</CardTitle>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {protocolData.safetyPrecautions && (
                  <div>
                    <h3 className="font-medium mb-2">Safety Precautions</h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {protocolData.safetyPrecautions.map((precaution, i) => (
                        <li key={i} className="text-muted-foreground">{precaution}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {protocolData.educationalResources && (
                  <div>
                    <h3 className="font-medium mb-2">Educational Resources</h3>
                    <div className="space-y-3">
                      {protocolData.educationalResources.map((resource, i) => (
                        <div key={i} className="text-sm">
                          <p className="font-medium">{resource.title}</p>
                          <p className="text-muted-foreground">{resource.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Eligibility Criteria Section */}
      <Collapsible>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle>Eligibility Criteria</CardTitle>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="space-y-6">
                {protocolData.eligibilityCriteria && protocolData.eligibilityCriteria.wearableData && protocolData.eligibilityCriteria.wearableData.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Wearable Data Requirements</h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {protocolData.eligibilityCriteria.wearableData.map((req, i) => (
                        <li key={i} className="text-muted-foreground">{req.metric}: {req.condition} {req.value}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {protocolData.eligibilityCriteria && protocolData.eligibilityCriteria.demographics && protocolData.eligibilityCriteria.demographics.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Demographics</h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {protocolData.eligibilityCriteria.demographics.map((demo, i) => (
                        <li key={i} className="text-muted-foreground">{demo.category}: {demo.requirement}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {protocolData.eligibilityCriteria && protocolData.eligibilityCriteria.customQuestions && protocolData.eligibilityCriteria.customQuestions.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Custom Questions</h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {protocolData.eligibilityCriteria.customQuestions.map((q, i) => (
                        <li key={i} className="text-muted-foreground">{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Custom Factors/Tags Section */}
      <Collapsible>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle>Study Tracking Factors</CardTitle>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Participants will track the following factors that may impact their sleep metrics:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    {
                      id: "lateCaffeine",
                      label: "Late caffeine",
                      description: "Consumed caffeine late in the day",
                      impactedMetrics: ["Sleep Score", "Sleep Latency"]
                    },
                    {
                      id: "lateMeal",
                      label: "Late meal",
                      description: "Consumed a meal close to bedtime",
                      impactedMetrics: ["Sleep Score", "HRV"]
                    },
                    {
                      id: "blueLight",
                      label: "Blue light",
                      description: "Extended screen exposure before bed",
                      impactedMetrics: ["Sleep Latency", "Sleep Score"]
                    },
                    {
                      id: "alcoholIntake",
                      label: "Alcohol intake",
                      description: "Consumed alcohol",
                      impactedMetrics: ["Deep Sleep", "REM Sleep"]
                    },
                    {
                      id: "stressLevel",
                      label: "Stress",
                      description: "High stress levels",
                      impactedMetrics: ["HRV", "Sleep Score"]
                    },
                    {
                      id: "exercise",
                      label: "Late workout",
                      description: "Exercise close to bedtime",
                      impactedMetrics: ["Sleep Latency", "HRV"]
                    }
                  ].map((factor) => (
                    <div
                      key={factor.id}
                      className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm"
                    >
                      <h4 className="font-medium mb-1">{factor.label}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {factor.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {factor.impactedMetrics.map((metric) => (
                          <span
                            key={metric}
                            className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                          >
                            {metric}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Consent Form Section */}
      <Collapsible>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle>Participant Consent Form</CardTitle>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="space-y-6">
                {/* Introduction */}
                <div>
                  <h3 className="font-medium mb-2">Introduction</h3>
                  <p className="text-sm text-muted-foreground">
                    You are being asked for your consent to take part in this research study. This document provides a concise summary of this research and what we expect from your participation. Your participation is voluntary and you may withdraw at any time.
                  </p>
                </div>

                {/* Purpose */}
                <div>
                  <h3 className="font-medium mb-2">Purpose of Research</h3>
                  <p className="text-sm text-muted-foreground">
                    This study aims to assess the impact of the intervention on sleep quality, recovery metrics, and overall well-being using Oura Ring data and participant feedback over {protocolData.durationWeeks} weeks.
                  </p>
                </div>

                {/* Expectations */}
                <div>
                  <h3 className="font-medium mb-2">Study Requirements</h3>
                  <ul className="list-disc list-inside text-sm space-y-2 text-muted-foreground">
                    <li>Wear your Oura Ring consistently throughout the study period</li>
                    <li>Complete daily tracking of relevant factors that may impact your sleep</li>
                    <li>Participate in required questionnaires at specified intervals</li>
                    <li>Follow the study protocol as directed</li>
                  </ul>
                </div>

                {/* Data Usage */}
                <div>
                  <h3 className="font-medium mb-2">Data Collection & Privacy</h3>
                  <p className="text-sm text-muted-foreground">
                    Your data will be collected through the Oura Ring device and our platform. All data is encrypted and stored securely. Your personal information will be de-identified for research purposes. You have the right to request your data be deleted at any time.
                  </p>
                </div>

                {/* Contact Information */}
                <div>
                  <h3 className="font-medium mb-2">Contact Information</h3>
                  <p className="text-sm text-muted-foreground">
                    For questions or concerns about the study, please contact the research team through the platform's messaging system or at support@reputable.health.
                  </p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* AI Insights Section */}
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

      {/* Action Buttons */}
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