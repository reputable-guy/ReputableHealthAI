import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { ProtocolData } from "@/pages/protocol-designer";
import { generateProtocolInsights } from "@/lib/protocol-insights";
import { useState } from "react";
import { Loader2, Info } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { validateStudyDesign, type ValidationResult } from "@/lib/study-validation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, AlertTriangle, CheckCircle } from "lucide-react";
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
          <p className="max-w-xs text-sm">{content}</p>
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
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Study Validation Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <PowerVisualization 
              power={validationResults.statisticalPower}
              sampleSize={protocolData.participantCount || 0}
              recommendedSize={validationResults.minimumSampleSize}
            />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Sample Size Analysis</h3>
            <p className="text-sm">
              Minimum recommended: {validationResults.minimumSampleSize} participants
              {protocolData.participantCount && (
                <span className={protocolData.participantCount >= validationResults.minimumSampleSize
                  ? "text-green-600"
                  : "text-red-600"
                }>
                  {" "}(Current: {protocolData.participantCount})
                </span>
              )}
            </p>
          </div>

          {validationResults.errors.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Issues to Address</h3>
              <div className="space-y-2">
                {validationResults.errors.map((error, index) => (
                  <Alert key={index} variant={error.severity === 'error' ? "destructive" : "default"}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{error.field}</AlertTitle>
                    <AlertDescription>{error.message}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {validationResults.regulatoryFlags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Regulatory Considerations</h3>
              <div className="space-y-2">
                {validationResults.regulatoryFlags.map((flag, index) => (
                  <Alert key={index} variant={flag.severity === 'high' ? "destructive" : "default"}>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>{flag.type} Compliance</AlertTitle>
                    <AlertDescription>{flag.description}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {validationResults.suggestions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Suggestions for Improvement</h3>
              <ul className="list-disc list-inside text-sm space-y-1">
                {validationResults.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {validationResults && <ValidationResults />}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            {protocolData.experimentTitle}
            <InfoTooltip content="The main title of your research study that describes its primary focus and design" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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

          {protocolData.studySummary && (
            <div>
              <h3 className="font-medium mb-2 flex items-center">
                Study Summary
                <InfoTooltip content="A concise overview of the study's purpose, methods, and expected results" />
              </h3>
              <p className="text-sm text-gray-600">{protocolData.studySummary}</p>
            </div>
          )}

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

          {protocolData.participantInstructions && protocolData.participantInstructions.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 flex items-center">
                Participant Instructions
                <InfoTooltip content="Step-by-step guidelines for participants to follow during the study" />
              </h3>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {protocolData.participantInstructions.map((instruction, i) => (
                  <li key={i}>{instruction}</li>
                ))}
              </ul>
            </div>
          )}

          {protocolData.safetyPrecautions && protocolData.safetyPrecautions.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 flex items-center">
                Safety and Precautions
                <InfoTooltip content="Important safety measures and considerations for participants and researchers" />
              </h3>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {protocolData.safetyPrecautions.map((precaution, i) => (
                  <li key={i}>{precaution}</li>
                ))}
              </ul>
            </div>
          )}

          {protocolData.educationalResources && protocolData.educationalResources.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 flex items-center">
                Educational Resources
                <InfoTooltip content="Supplementary materials provided to participants for better understanding" />
              </h3>
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

          {protocolData.consentFormSections && protocolData.consentFormSections.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 flex items-center">
                Consent Form
                <InfoTooltip content="Sections outlining participants' rights, risks, and responsibilities" />
              </h3>
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

          {protocolData.customFactors && protocolData.customFactors.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 flex items-center">
                Custom Factors to Track
                <InfoTooltip content="Additional factors to monitor during the study, beyond standard metrics" />
              </h3>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {protocolData.customFactors.map((factor, i) => (
                  <li key={i}>{factor}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="font-medium mb-2 flex items-center">
              Eligibility Criteria
              <InfoTooltip content="Requirements participants must meet to be included in the study" />
            </h3>

            {protocolData.eligibilityCriteria?.wearableData && protocolData.eligibilityCriteria.wearableData.length > 0 && (
              <div className="mb-3">
                <h4 className="text-sm font-medium mb-1 flex items-center">
                  Wearable Data Requirements
                  <InfoTooltip content="Specific wearable device metrics required for participation" />
                </h4>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  {protocolData.eligibilityCriteria.wearableData.map((req, i) => (
                    <li key={i}>{req.metric}: {req.condition} {req.value}</li>
                  ))}
                </ul>
              </div>
            )}

            {protocolData.eligibilityCriteria?.demographics && protocolData.eligibilityCriteria.demographics.length > 0 && (
              <div className="mb-3">
                <h4 className="text-sm font-medium mb-1 flex items-center">
                  Demographics
                  <InfoTooltip content="Demographic characteristics considered for participant selection" />
                </h4>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  {protocolData.eligibilityCriteria.demographics.map((demo, i) => (
                    <li key={i}>
                      {demo.category}: {demo.requirement}
                    </li>
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
          onClick={() => runValidation.mutate()}
          disabled={runValidation.isPending}
        >
          {runValidation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Validating Study Design...
            </>
          ) : (
            "Validate Study Design"
          )}
        </Button>

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