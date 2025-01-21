import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { generateLiteratureReview, type LiteratureReview } from "@/lib/literatureReviewService";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function LiteratureReviewPage() {
  const { toast } = useToast();
  const [review, setReview] = useState<LiteratureReview | null>(null);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);

  const { mutate: generateReview, isPending } = useMutation({
    mutationFn: generateLiteratureReview,
    onSuccess: (data) => {
      setReview(data);
      toast({
        title: "Success",
        description: "Literature review generated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate review",
        variant: "destructive",
      });
      // Redirect back to input page on error
      setLocation("/input");
    },
  });

  // Memoize the initial data fetching
  const initializeReview = useCallback(() => {
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

    // Only generate if we don't already have a review
    if (!review && !isPending) {
      generateReview({
        productName,
        websiteUrl: websiteUrl || undefined
      });
    }
  }, [params, generateReview, toast, setLocation, review, isPending]);

  // Call initialize only once when component mounts
  useState(() => {
    initializeReview();
  }, []);

  const handleProceedToHypotheses = () => {
    const productName = params.get("product");
    if (productName) {
      setLocation(`/design?product=${encodeURIComponent(productName)}`);
    }
  };

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Generating Literature Review...</p>
          <p className="text-sm text-muted-foreground">This may take a few moments</p>
        </div>
      </div>
    );
  }

  if (!review) {
    return null;
  }

  return (
    <div className="container mx-auto py-10 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Literature Review</CardTitle>
            <Button onClick={handleProceedToHypotheses}>
              Generate Hypotheses
            </Button>
          </div>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <section>
            <h3 className="text-xl font-semibold mb-4">Overview</h3>
            <p>{review.overview.description}</p>

            <div className="mt-4">
              <h4 className="font-semibold">Primary Benefits</h4>
              <ul>
                {review.overview.benefits.map((benefit, index) => (
                  <li key={index}>{benefit}</li>
                ))}
              </ul>
            </div>

            <div className="mt-4">
              <h4 className="font-semibold">Common Supplement Forms</h4>
              <ul>
                {review.overview.supplementForms.map((form, index) => (
                  <li key={index}>{form}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="mt-8">
            <h3 className="text-xl font-semibold mb-4">Wellness Areas</h3>
            {review.wellnessAreas.map((area, index) => (
              <div key={index} className="mb-6">
                <h4 className="font-semibold text-lg">{area.name}</h4>
                <p className="mt-2">{area.mechanism}</p>

                <div className="mt-3">
                  <h5 className="font-medium">Key Findings</h5>
                  <ul>
                    {area.keyFindings.map((finding, idx) => (
                      <li key={idx}>{finding}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3">
                  <h5 className="font-medium">Research Gaps</h5>
                  <ul>
                    {area.researchGaps.map((gap, idx) => (
                      <li key={idx}>{gap}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </section>

          <section className="mt-8">
            <h3 className="text-xl font-semibold mb-4">Research Gaps & Future Studies</h3>
            <ul>
              {review.researchGaps.questions.map((question, index) => (
                <li key={index}>{question}</li>
              ))}
            </ul>
          </section>

          <section className="mt-8">
            <h3 className="text-xl font-semibold mb-4">Conclusion</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">Key Points</h4>
                <ul>
                  {review.conclusion.keyPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold">Target Audience</h4>
                <ul>
                  {review.conclusion.targetAudience.map((audience, index) => (
                    <li key={index}>{audience}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold">Safety Considerations</h4>
                <ul>
                  {review.conclusion.safetyConsiderations.map((safety, index) => (
                    <li key={index}>{safety}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}