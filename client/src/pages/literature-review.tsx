import { useState, useEffect } from "react";
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

    if (!review && !isPending) {
      generateReview({
        productName,
        websiteUrl: websiteUrl || undefined
      });
    }
  }, [params, generateReview, toast, setLocation, review, isPending]);

  const handleProceedToHypotheses = () => {
    const productName = params.get("product");
    const websiteUrl = params.get("url");
    const queryParams = new URLSearchParams({
      product: productName || "",
      ...(websiteUrl && { url: websiteUrl }),
      autoGenerate: "true"
    });
    setLocation(`/protocols/hypotheses?${queryParams.toString()}`);
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
            <CardTitle>{review.title}</CardTitle>
            <Button onClick={handleProceedToHypotheses}>
              Generate Hypotheses
            </Button>
          </div>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          {/* Overview Section */}
          <section>
            <h2 className="text-2xl font-bold mb-4">1. Overview</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold">What is {params.get("product")}?</h3>
                <ul className="list-disc pl-6">
                  {review.overview.description.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>

              <div>
                <ul className="list-none pl-6">
                  {review.overview.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-green-600">✅</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <ul className="list-disc pl-6">
                  {review.overview.supplementForms.map((form, index) => (
                    <li key={index}>{form}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Wellness Areas Section */}
          <section className="mt-8">
            <h2 className="text-2xl font-bold mb-4">2. Impact on Key Wellness Areas</h2>
            {review.wellnessAreas.map((area, index) => (
              <div key={index} className="mb-8">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <span>{area.emoji}</span> {area.name}
                </h3>

                <div className="space-y-4 mt-4">
                  <div>
                    <h4 className="font-semibold">How It Works</h4>
                    <ul className="list-disc pl-6">
                      {area.mechanism.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold">Key Findings</h4>
                    <ul className="list-none pl-6">
                      {area.keyFindings.map((finding, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-green-600">✅</span>
                          {finding}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold">Research Gaps</h4>
                    <ul className="list-none pl-6">
                      {area.researchGaps.map((gap, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-red-600">❌</span>
                          {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* Research Gaps Section */}
          <section className="mt-8">
            <h2 className="text-2xl font-bold mb-4">3. Research Gaps & Future Studies</h2>
            <div>
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <span>📌</span> Unanswered Questions in Research
              </h3>
              <ul className="list-disc pl-6 mt-2">
                {review.researchGaps.questions.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* Conclusion Section */}
          <section className="mt-8">
            <h2 className="text-2xl font-bold mb-4">4. Conclusion</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold">Key Points</h3>
                <ul className="list-disc pl-6">
                  {review.conclusion.keyPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold">Safety Considerations</h3>
                <ul className="list-disc pl-6">
                  {review.conclusion.safetyConsiderations.map((safety, index) => (
                    <li key={index}>{safety}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <span>📌</span> Who Benefits Most?
                </h3>
                <ul className="list-none pl-6">
                  {review.conclusion.targetAudience.map((audience, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-green-600">✅</span>
                      {audience}
                    </li>
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