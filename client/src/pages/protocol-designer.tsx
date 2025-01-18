import { useState } from "react";
import { Card } from "@/components/ui/card";
import StudySetupForm from "@/components/protocol/study-setup-form";
import ProtocolPreview from "@/components/protocol/protocol-preview";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

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
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSetupComplete = async (setupData: Partial<ProtocolData>) => {
    setError(null);
    try {
      const response = await fetch("/api/protocols/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(setupData),
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
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <Card className="max-w-4xl mx-auto">
          <div className="p-6">
            {error ? (
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
            ) : !protocolData ? (
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