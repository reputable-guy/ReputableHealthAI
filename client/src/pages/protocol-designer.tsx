import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StudySetupForm from "@/components/protocol/study-setup-form";
import ProtocolGenerator from "@/components/protocol/protocol-generator";
import EligibilityCriteria from "@/components/protocol/eligibility-criteria";
import ProtocolPreview from "@/components/protocol/protocol-preview";
import { Card } from "@/components/ui/card";

export type ProtocolData = {
  productName: string;
  websiteUrl?: string;
  studyGoal: string;
  studyCategory: string;
  experimentTitle: string;
  studyObjective: string;
  studyType: string;
  participantCount: number;
  durationWeeks: number;
  targetMetrics: string[];
  questionnaires: string[];
  eligibilityCriteria: {
    wearableData: any[];
    demographics: any[];
    customQuestions: string[];
  };
};

export default function ProtocolDesigner() {
  const [currentStep, setCurrentStep] = useState("setup");
  const [protocolData, setProtocolData] = useState<Partial<ProtocolData>>({});

  const handleStepComplete = (stepData: Partial<ProtocolData>) => {
    setProtocolData({ ...protocolData, ...stepData });
    const steps = ["setup", "generator", "eligibility", "preview"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <Card className="max-w-4xl mx-auto">
          <Tabs value={currentStep} className="p-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="setup">Study Setup</TabsTrigger>
              <TabsTrigger value="generator">Protocol</TabsTrigger>
              <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="setup">
              <StudySetupForm onComplete={handleStepComplete} initialData={protocolData} />
            </TabsContent>

            <TabsContent value="generator">
              <ProtocolGenerator onComplete={handleStepComplete} initialData={protocolData} />
            </TabsContent>

            <TabsContent value="eligibility">
              <EligibilityCriteria onComplete={handleStepComplete} initialData={protocolData} />
            </TabsContent>

            <TabsContent value="preview">
              <ProtocolPreview protocolData={protocolData} />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
