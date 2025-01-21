import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

const verificationRequestSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  websiteUrl: z.string().url("Please enter a valid URL").optional(),
});

interface ProductVerification {
  scrapedContent: {
    rawText: string;
    wordCount: number;
    keyPhrases: string[];
  };
  productContext: {
    identifiedName: boolean;
    hasIngredients: boolean;
    hasDosage: boolean;
    contentQuality: 'Poor' | 'Fair' | 'Good';
  };
}

async function verifyProduct(request: z.infer<typeof verificationRequestSchema>): Promise<ProductVerification> {
  const response = await fetch("/api/verify-product", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to verify product");
  }

  const data = await response.json();
  return data.verification;
}

export default function VerificationPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [verification, setVerification] = useState<ProductVerification | null>(null);

  const { mutate: runVerification, isPending } = useMutation({
    mutationFn: verifyProduct,
    onSuccess: (data) => {
      setVerification(data);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to verify product",
        variant: "destructive",
      });
      setLocation("/input");
    },
  });

  useEffect(() => {
    const productName = params.get("product");
    const websiteUrl = params.get("url");

    if (!productName) {
      toast({
        title: "Error",
        description: "Product name is required",
        variant: "destructive",
      });
      setLocation("/input");
      return;
    }

    if (!verification && !isPending) {
      runVerification({
        productName,
        websiteUrl: websiteUrl || undefined
      });
    }
  }, [params, runVerification, toast, setLocation, verification, isPending]);

  const handleProceedToReview = () => {
    const productName = params.get("product");
    const websiteUrl = params.get("url");
    const searchParams = new URLSearchParams();
    if (productName) searchParams.set("product", productName);
    if (websiteUrl) searchParams.set("url", websiteUrl);
    setLocation(`/literature-review?${searchParams.toString()}`);
  };

  const handleGoBack = () => {
    setLocation("/input");
  };

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Verifying Product Information...</p>
          <p className="text-sm text-muted-foreground">This may take a moment</p>
        </div>
      </div>
    );
  }

  if (!verification) {
    return null;
  }

  const getQualityColor = (quality: 'Poor' | 'Fair' | 'Good') => {
    switch (quality) {
      case 'Poor': return 'text-red-500';
      case 'Fair': return 'text-yellow-500';
      case 'Good': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Product Information Verification</CardTitle>
          <CardDescription>
            Review the extracted information before proceeding with the literature review
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Content Quality</h3>
              <span className={`font-semibold ${getQualityColor(verification.productContext.contentQuality)}`}>
                {verification.productContext.contentQuality}
              </span>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                {verification.productContext.identifiedName ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                <span>Product name identified in content</span>
              </div>
              <div className="flex items-center gap-2">
                {verification.productContext.hasIngredients ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                <span>Ingredients information found</span>
              </div>
              <div className="flex items-center gap-2">
                {verification.productContext.hasDosage ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                <span>Dosage information found</span>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Key Information Found</h3>
              <div className="bg-muted p-4 rounded-md">
                <ul className="list-disc pl-4 space-y-1">
                  {verification.scrapedContent.keyPhrases.map((phrase, index) => (
                    <li key={index} className="text-sm">{phrase}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Content Preview</h3>
              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm text-muted-foreground">
                  {verification.scrapedContent.rawText}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Total words: {verification.scrapedContent.wordCount}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleGoBack}>
              Go Back
            </Button>
            <Button 
              onClick={handleProceedToReview}
              disabled={verification.productContext.contentQuality === 'Poor'}
            >
              Continue to Literature Review
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
