import { useState } from "react";
import { Card } from "@/components/ui/card";
import StudySetupForm from "@/components/protocol/study-setup-form";
import ProtocolPreview from "@/components/protocol/protocol-preview";
import { generateProtocolInsights } from "@/lib/protocol-insights";
import { useToast } from "@/hooks/use-toast";

export type ProtocolData = {
  productName: string;
  websiteUrl?: string;
  studyGoal: string;
  studyCategory?: string;
  experimentTitle?: string;
  studyObjective?: string;
  studyType?: string;
  participantCount?: number;
  durationWeeks?: number;
  targetMetrics?: string[];
  questionnaires?: string[];
  eligibilityCriteria?: {
    wearableData: any[];
    demographics: any[];
    customQuestions: string[];
  };
};

export default function ProtocolDesigner() {
  const [protocolData, setProtocolData] = useState<Partial<ProtocolData>>();
  const { toast } = useToast();

  const handleSetupComplete = async (setupData: Partial<ProtocolData>) => {
    try {
      const fullProtocol = await generateProtocolInsights(setupData);
      setProtocolData(fullProtocol);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate protocol. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <Card className="max-w-4xl mx-auto">
          <div className="p-6">
            {!protocolData ? (
              <StudySetupForm onComplete={handleSetupComplete} />
            ) : (
              <ProtocolPreview protocolData={protocolData} />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}