import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface Hypothesis {
  id: number;
  category: string;
  statement: string;
  rationale: string;
  confidenceScore: number;
}

interface HypothesisSelectorProps {
  onHypothesisSelected: (hypothesis: Hypothesis) => void;
  productName: string;
  websiteUrl: string;
}

export default function HypothesisSelector({ 
  onHypothesisSelected,
  productName,
  websiteUrl
}: HypothesisSelectorProps) {
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateHypotheses = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/protocols/hypotheses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, websiteUrl })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Failed to generate hypotheses");
      }

      const data = await response.json();
      setHypotheses(data.hypotheses);
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate hypotheses when component mounts
  useEffect(() => {
    generateHypotheses();
  }, [productName, websiteUrl]); // Re-run if product name or website changes

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return "bg-green-500";
    if (score >= 0.6) return "bg-blue-500";
    if (score >= 0.4) return "bg-yellow-500";
    return "bg-red-500";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-lg">Analyzing product and generating research hypotheses...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {hypotheses.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Select a Research Hypothesis</h3>
          <p className="text-sm text-muted-foreground">
            Based on our analysis, here are the most promising research hypotheses for your product.
            Select one to proceed with protocol generation.
          </p>
          {hypotheses.map((hypothesis) => (
            <Card
              key={hypothesis.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => onHypothesisSelected(hypothesis)}
            >
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      {hypothesis.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-muted-foreground">
                        Confidence Score:
                      </div>
                      <div className="w-32 flex items-center gap-2">
                        <Progress 
                          value={hypothesis.confidenceScore * 100} 
                          className={`${getConfidenceColor(hypothesis.confidenceScore)}`}
                        />
                        <span className="text-sm font-medium min-w-[3ch]">
                          {Math.round(hypothesis.confidenceScore * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="font-medium">{hypothesis.statement}</p>
                  <p className="text-sm text-muted-foreground">{hypothesis.rationale}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}