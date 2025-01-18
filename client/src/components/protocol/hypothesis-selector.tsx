import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Hypothesis {
  id: number;
  category: string;
  statement: string;
  rationale: string;
  confidenceScore: number;
}

interface HypothesisSelectorProps {
  onHypothesisSelected: (hypothesis: Hypothesis) => void;
}

export default function HypothesisSelector({ onHypothesisSelected }: HypothesisSelectorProps) {
  const [productName, setProductName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
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

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="productName">Product Name</Label>
          <Input
            id="productName"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Enter product name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="websiteUrl">Product Website (optional)</Label>
          <Input
            id="websiteUrl"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="Enter product website URL"
          />
        </div>

        <Button 
          onClick={generateHypotheses} 
          disabled={!productName || loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing Product...
            </>
          ) : (
            "Generate Research Hypotheses"
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {hypotheses.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Select a Research Hypothesis</h3>
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
                    <span className="text-sm text-muted-foreground">
                      Confidence: {Math.round(hypothesis.confidenceScore * 100)}%
                    </span>
                  </div>
                  <p className="font-medium">{hypothesis.statement}</p>
                  <p className="text-sm text-muted-foreground">{hypothesis.rationale}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
