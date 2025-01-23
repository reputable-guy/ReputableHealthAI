import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import HypothesisSelector from "@/components/protocol/hypothesis-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function HypothesesPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  
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

  const handleHypothesisSelected = (hypothesis: any) => {
    const queryParams = new URLSearchParams({
      product: productName,
      ...(websiteUrl && { url: websiteUrl }),
      hypothesis: JSON.stringify(hypothesis),
    });
    setLocation(`/design?${queryParams.toString()}`);
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
          <HypothesisSelector
            productName={productName}
            websiteUrl={websiteUrl || ""}
            onHypothesisSelected={handleHypothesisSelected}
          />
        </CardContent>
      </Card>
    </div>
  );
}
