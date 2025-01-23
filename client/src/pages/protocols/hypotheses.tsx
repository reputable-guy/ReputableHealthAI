import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import HypothesisSelector from "@/components/protocol/hypothesis-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ProtocolPreview from "@/components/protocol/protocol-preview";
import type { ProtocolData } from "@/pages/protocol-designer";

export default function HypothesesPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [protocolData, setProtocolData] = useState<ProtocolData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const productName = params.get("product");
  const websiteUrl = params.get("url");
  const autoGenerate = params.get("autoGenerate") === "true";

  useEffect(() => {
    if (!productName) {
      setLocation("/input");
    }
  }, [productName, setLocation]);

  if (!productName) return null;

  const handleBack = () => {
    const queryParams = new URLSearchParams({
      product: productName,
      ...(websiteUrl && { url: websiteUrl }),
    });
    setLocation(`/literature-review?${queryParams.toString()}`);
  };

  const handleHypothesisSelected = async (hypothesis: any) => {
    console.log('Selected hypothesis:', hypothesis);
    try {
      // Directly generate protocol here instead of navigating
      const response = await fetch("/api/protocols/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productName,
          websiteUrl: websiteUrl || "",
          selectedHypothesis: hypothesis.statement,
          studyCategory: hypothesis.category,
          studyObjective: hypothesis.statement,
          studyGoal: "Evaluate product efficacy"
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Failed to generate protocol");
      }

      const data = await response.json();
      setProtocolData(data);
    } catch (error: any) {
      console.error('Error generating protocol:', error);
      setError(error.message || "Failed to generate protocol");
    }
  };

  return (
    <div className="container mx-auto py-10 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Research Hypotheses</CardTitle>
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Literature Review
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {protocolData ? (
            <ProtocolPreview protocolData={protocolData} />
          ) : (
            <HypothesisSelector
              productName={productName}
              websiteUrl={websiteUrl || ""}
              onHypothesisSelected={handleHypothesisSelected}
            />
          )}
          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-md">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}