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
import { useState, useEffect } from "react";
import { Loader2, Info, Shield, AlertTriangle, CheckCircle, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { validateStudyDesign } from "@/lib/study-validation";
import PowerVisualization from "./power-visualization";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import RiskAssessmentVisualization from "./risk-assessment-visualization";

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

// Helper function to generate IRB submission (needs implementation)
const generateIrbSubmission = async (protocolData: Partial<ProtocolData>) => {
  const res = await fetch("/api/protocols/irb-submission", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      protocol: {
        title: protocolData.experimentTitle,
        studyObjective: protocolData.studyObjective,
        studyDesign: protocolData.studyType,
        participantCount: protocolData.participantCount,
        eligibilityCriteria: protocolData.eligibilityCriteria?.customQuestions || [],
        procedures: protocolData.targetMetrics || [],
        durationWeeks: protocolData.durationWeeks,
        risks: [],
        safetyPrecautions: protocolData.safetyPrecautions || [],
        dataCollection: {},
        dataStorage: {},
        analysisMethod: {},
        timeline: []
      },
      literatureReview: protocolData.literatureReview, // Assuming literatureReview is now part of protocolData
      riskAssessment: protocolData.riskAssessment // Assuming riskAssessment is now part of protocolData

    })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to generate IRB submission");
  }

  const data = await res.json();
  return data.submission;
};


export default function ProtocolPreview({ protocolData }: ProtocolPreviewProps) {
  const { toast } = useToast();
  const [irbSubmission, setIrbSubmission] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationResult | null>(null);
  const [localProtocolData, setLocalProtocolData] = useState<Partial<ProtocolData>>(protocolData);

  // Run validation when protocol data changes
  useEffect(() => {
    if (localProtocolData.participantCount && localProtocolData.studyType) {
      runValidation.mutate();
    }
  }, [localProtocolData]);

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

  const generateIRBSubmission = useMutation({
    mutationFn: async () => {
      try {
        // Make sure we have all required data
        if (!protocolData.productName || !protocolData.websiteUrl) {
          throw new Error("Missing required product information");
        }

        // Generate IRB submission using the service
        const submission = await generateIrbSubmission(protocolData);
        return submission;
      } catch (error) {
        console.error('Error generating IRB submission:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      setIrbSubmission(data);
      toast({
        title: "IRB Submission Generated",
        description: "Your IRB submission document has been generated successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate IRB submission. Please try again.",
        variant: "destructive"
      });
    }
  });

  const runValidation = useMutation({
    mutationFn: async () => {
      const results = await validateStudyDesign(localProtocolData);
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

  // Add handleParameterUpdate function
  const handleParameterUpdate = async (params: {
    effectSize: number;
    power: number;
    alpha: number;
    calculatedSampleSize: number;
  }) => {
    // Update the local protocol data with new sample size
    setLocalProtocolData(prev => ({
      ...prev,
      participantCount: params.calculatedSampleSize
    }));

    // Run validation with new parameters
    const results = await validateStudyDesign({
      ...localProtocolData,
      participantCount: params.calculatedSampleSize,
      effectSize: params.effectSize,
      power: params.power,
      alpha: params.alpha
    });

    setValidationResults(results);

    toast({
      title: "Parameters Updated",
      description: "Study design parameters have been recalculated."
    });
  };

  const generateRiskAssessment = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/protocols/risk-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(protocolData)
      });

      if (!res.ok) {
        throw new Error("Failed to generate risk assessment");
      }

      const data = await res.json();
      return data.assessment;
    },
    onSuccess: (data) => {
      setLocalProtocolData(prev => ({
        ...prev,
        riskAssessment: data
      }));
      toast({
        title: "Risk Assessment Complete",
        description: `Overall Risk Level: ${data.riskLevel}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate risk assessment. Please try again.",
        variant: "destructive"
      });
    }
  });

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

        <Card className="relative">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground mb-1">Statistical Design</p>
              <p className="text-2xl font-semibold">{localProtocolData.participantCount} participants</p>
              {validationResults && (
                <>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <div
                      className={`text-sm ${
                        validationResults.statisticalPower >= 0.8
                          ? "text-green-600"
                          : validationResults.statisticalPower >= 0.6
                            ? "text-yellow-600"
                            : "text-red-600"
                      }`}
                    >
                      {(validationResults.statisticalPower * 100).toFixed(1)}% Statistical Power
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2">
                          View Analysis
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Statistical Power Analysis</DialogTitle>
                        </DialogHeader>
                        <PowerVisualization
                          power={validationResults.statisticalPower}
                          sampleSize={localProtocolData.participantCount || 0}
                          recommendedSize={validationResults.minimumSampleSize}
                          effectSize={validationResults.effectSize || 0.5}
                          confidence={validationResults.confidence || 0.8}
                          powerCurve={validationResults.powerCurve || []}
                          confidenceInterval={validationResults.confidenceInterval}
                          onUpdateParameters={handleParameterUpdate}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <p>Effect Size: {((validationResults.effectSize || 0.5) * 100).toFixed(1)}%</p>
                    {validationResults.statisticalPower < 0.8 && (
                      <p className="text-yellow-600">
                        Recommended: {validationResults.minimumSampleSize} participants
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
                    You are being asked for your consent to take part in the study. This document provides a concise summary of this research and expectations associated with participating. Your participation in this study is voluntary. You may decide not to participate or you may leave the study at any time. Your decision will not result in any penalty or loss to which you are otherwise entitled.
                  </p>
                </div>

                {/* Contact Information */}
                <div>
                  <h3 className="font-medium mb-2">Contact Information</h3>
                  <p className="text-sm text-muted-foreground">
                    If you have any questions, you can contact the research team anytime at mackenzie@reputable.health, or by using the chat feature located in your Reputable Health dashboard.
                  </p>
                </div>

                {/* Purpose */}
                <div>
                  <h3 className="font-medium mb-2">Why is this research being done?</h3>
                  <p className="text-sm text-muted-foreground">
                    The purpose of this research is to assess the impact of the {protocolData.productName} on participant {protocolData.studyCategory.toLowerCase()}, mental well-being, and other health metrics in a real world setting following a {protocolData.durationWeeks}-week intervention period.
                  </p>
                </div>

                {/* Expectations */}
                <div>
                  <h3 className="font-medium mb-2">What is expected of me if I agree to take part in this research?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    If you decide to take part in this research study, you will be asked to engage in the following activities:
                  </p>
                  <ul className="list-decimal list-inside text-sm space-y-4 text-muted-foreground">
                    <li className="pl-2">
                      <span className="font-medium">Complete Surveys:</span> You will be required to complete two surveys—one at the start of the study (baseline, 0 weeks) and another at the end of the study ({protocolData.durationWeeks} weeks). These surveys are designed to gather information on your {protocolData.studyCategory.toLowerCase()} patterns, well-being, and other relevant metrics.
                    </li>
                    <li className="pl-2">
                      <span className="font-medium">Connect and Wear Your Oura Device:</span> You will need to connect your Oura Ring device to the Reputable platform. This connection will allow us to collect objective data on your {protocolData.studyCategory.toLowerCase()} and other health-related biomarker metrics continuously throughout the study period. It is important that you keep your Oura Ring charged and wear it over the course of the study period.
                    </li>
                    <li className="pl-2">
                      <span className="font-medium">Intervention Adherence:</span> You will be asked to follow the study protocol as directed. It is important that you follow these instructions carefully to ensure the accuracy and reliability of the study's results. You will be automatically withdrawn from the study if you fail to meet a 70% compliance threshold. Compliance is defined as you confirming your daily protocol adherence in the Reputable Health app.
                    </li>
                  </ul>
                </div>

                {/* Risks */}
                <div>
                  <h3 className="font-medium mb-2">What are the risks associated with participating in this study?</h3>
                  <p className="text-sm text-muted-foreground">
                    The research team has taken steps to minimize the risks of this study. Even so, you may still experience some risks related to your participation, even when the researchers are careful to avoid them. These risks will be detailed in your specific protocol instructions. Please report any issues or concerns to the research team immediately.
                  </p>
                </div>

                {/* Benefits */}
                <div>
                  <h3 className="font-medium mb-2">What are the benefits associated with participating in this study?</h3>
                  <p className="text-sm text-muted-foreground">
                    By participating in this study, you may experience potential benefits. Through use of the Reputable Health app and the continuous monitoring of biomarker metrics, you may also become more aware of your {protocolData.studyCategory.toLowerCase()} patterns and overall health metrics, which may help establish more informed decisions about your health. You will also be contributing to a foundation of scientific knowledge that will contribute to the growth of a body of research assessing the effectiveness of the intervention on {protocolData.studyCategory.toLowerCase()} and health.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    While the study has the potential to provide these benefits, it is important to note that benefits are not guaranteed, and the primary goal of the research is to gather data that will contribute to scientific understanding. Your involvement is greatly valued and will play a key role in advancing knowledge in this area.
                  </p>
                </div>

                {/* Incentives */}
                <div>
                  <h3 className="font-medium mb-2">Are there any incentives associated with participating in this research?</h3>
                  <p className="text-sm text-muted-foreground">
                    Participants in this study will receive compensation for their time and effort, contingent on their adherence to study protocols and the completion of key milestones. Upon successful completion of the study, defined as maintaining at least 70% adherence to the study protocols and completing the end-of-study survey, participants will be awarded an electronic gift card valued at $50.
                  </p>
                </div>

                {/* Privacy */}
                <div>
                  <h3 className="font-medium mb-2">How are you protecting privacy and ensuring confidentiality?</h3>
                  <p className="text-sm text-muted-foreground">
                    Upon enrollment into the Reputable App, all participants are de-identified using a randomly assigned alias that will follow them throughout the course of their participation in the study and time in the Reputable platform. All communications and research activities will be conducted under the alias and personal identifying information will be minimized to an administrative level for safety and regulatory purposes only.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    De-identified data from this study will be shared with the commercial sponsor of the study and used to validate claims surrounding product efficacy and to advance future research in this area. No personal information that could be used to identify you will be shared with any external parties, including the sponsor.
                  </p>
                </div>

                {/* Consent Statement */}
                <div>
                  <h3 className="font-medium mb-2">Statement of Consent</h3>
                  <p className="text-sm text-muted-foreground">
                    By completing this consent, I confirm that I have read the above information, and have received answers to any questions I asked. I consent to take part in the study.
                  </p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* IRB Submission Section */}
      {irbSubmission && (
        <Card>
          <CardHeader>
            <CardTitle>IRB Submission Document</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{irbSubmission}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Assessment Section */}
      {localProtocolData.riskAssessment && (
        <Card>
          <CardHeader>
            <CardTitle>Protocol Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <RiskAssessmentVisualization assessment={localProtocolData.riskAssessment} />
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        <Button
          className="w-full"
          onClick={() => generateRiskAssessment.mutate()}
          disabled={generateRiskAssessment.isPending}
        >
          {generateRiskAssessment.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing Protocol Risks...
            </>
          ) : (
            "Generate Risk Assessment"
          )}
        </Button>
        <Button
          className="w-full"
          onClick={() => generateIRBSubmission.mutate()}
          disabled={generateIRBSubmission.isPending}
        >
          {generateIRBSubmission.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating IRB Submission...
            </>
          ) : (
            "Generate IRB Submission"
          )}
        </Button>
        <Button
          className="w-full"
          onClick={() => saveProtocol.mutate(localProtocolData)}
          disabled={saveProtocol.isPending}
        >
          {saveProtocol.isPending ? "Saving..." : "Save Protocol"}
        </Button>
      </div>
    </div>
  );
}