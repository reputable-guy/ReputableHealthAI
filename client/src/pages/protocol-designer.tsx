import { useState } from "react";
import { Card } from "@/components/ui/card";
import StudySetupForm from "@/components/protocol/study-setup-form";
import ProtocolPreview from "@/components/protocol/protocol-preview";
import HypothesisSelector from "@/components/protocol/hypothesis-selector";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface Hypothesis {
  id: number;
  category: string;
  statement: string;
  rationale: string;
  confidenceScore: number;
}

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
  selectedHypothesis?: string; // Added to include hypothesis in protocolData
};

export default function ProtocolDesigner() {
  const [protocolData, setProtocolData] = useState<Partial<ProtocolData>>();
  const [selectedHypothesis, setSelectedHypothesis] = useState<Hypothesis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleHypothesisSelected = (hypothesis: Hypothesis) => {
    setSelectedHypothesis(hypothesis);
    setProtocolData({
      studyCategory: hypothesis.category,
      studyObjective: hypothesis.statement
    });
  };

  const handleSetupComplete = async (setupData: Partial<ProtocolData>) => {
    setError(null);
    try {
      const response = await fetch("/api/protocols/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...setupData,
          selectedHypothesis: selectedHypothesis?.statement
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Failed to generate protocol");
      }

      const data = await response.json();
      setProtocolData(data);
    } catch (error: any) {
      const errorMessage = error.message || "Failed to generate protocol. Please try again.";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleRetry = () => {
    setError(null);
    setProtocolData(undefined);
    setSelectedHypothesis(null);
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={handleRetry} className="w-full">
            Try Again
          </Button>
        </div>
      );
    }

    if (!selectedHypothesis) {
      return <HypothesisSelector onHypothesisSelected={handleHypothesisSelected} />;
    }

    if (!protocolData?.studyType) {
      return (
        <StudySetupForm
          onComplete={handleSetupComplete}
          initialData={{
            studyCategory: selectedHypothesis.category,
            studyObjective: selectedHypothesis.statement
          }}
        />
      );
    }

    return <ProtocolPreview protocolData={protocolData} />;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <Card className="max-w-4xl mx-auto">
          <div className="p-6">
            {renderContent()}
          </div>
        </Card>
      </div>
    </div>
  );
}