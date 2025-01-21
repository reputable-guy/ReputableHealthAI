import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { literatureReviewRequestSchema, type LiteratureReview } from "@/lib/literatureReviewService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AlertCircle, Plus, Trash } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { generateLiteratureReview } from "@/lib/literatureReviewService";

export default function LiteratureReviewPage() {
  const [ingredients, setIngredients] = useState<string[]>([""]);
  const { toast } = useToast();
  const [review, setReview] = useState<LiteratureReview | null>(null);

  const form = useForm({
    resolver: zodResolver(literatureReviewRequestSchema),
    defaultValues: {
      productName: "",
      ingredients: [],
    },
  });

  const { mutate: generateReview, isLoading } = useMutation({
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
    },
  });

  const addIngredient = () => {
    setIngredients([...ingredients, ""]);
  };

  const removeIngredient = (index: number) => {
    const newIngredients = ingredients.filter((_, i) => i !== index);
    setIngredients(newIngredients);
  };

  const onSubmit = form.handleSubmit((data) => {
    const validIngredients = ingredients.filter((i) => i.trim() !== "");
    if (validIngredients.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one ingredient",
        variant: "destructive",
      });
      return;
    }
    generateReview({ productName: data.productName, ingredients: validIngredients });
  });

  return (
    <div className="container mx-auto py-10 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Generate Literature Review</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-8">
              <FormField
                control={form.control}
                name="productName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter product name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <FormLabel>Ingredients</FormLabel>
                {ingredients.map((ingredient, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={ingredient}
                      onChange={(e) => {
                        const newIngredients = [...ingredients];
                        newIngredients[index] = e.target.value;
                        setIngredients(newIngredients);
                      }}
                      placeholder={`Ingredient ${index + 1}`}
                    />
                    {ingredients.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeIngredient(index)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addIngredient}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Ingredient
                </Button>
              </div>

              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Generating..." : "Generate Review"}
              </Button>
            </form>
          </Form>

          {review && (
            <div className="mt-8 space-y-6">
              <h2 className="text-2xl font-bold">Generated Review</h2>
              
              <section>
                <h3 className="text-xl font-semibold mb-4">Overview</h3>
                <p>{review.overview.description}</p>
                
                <div className="mt-4">
                  <h4 className="font-semibold">Primary Benefits</h4>
                  <ul className="list-disc pl-5 mt-2">
                    {review.overview.benefits.map((benefit, index) => (
                      <li key={index}>{benefit}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="mt-4">
                  <h4 className="font-semibold">Common Supplement Forms</h4>
                  <ul className="list-disc pl-5 mt-2">
                    {review.overview.supplementForms.map((form, index) => (
                      <li key={index}>{form}</li>
                    ))}
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-semibold mb-4">Wellness Areas</h3>
                {review.wellnessAreas.map((area, index) => (
                  <div key={index} className="mb-6">
                    <h4 className="font-semibold text-lg">{area.name}</h4>
                    <p className="mt-2">{area.mechanism}</p>
                    
                    <div className="mt-3">
                      <h5 className="font-medium">Key Findings</h5>
                      <ul className="list-disc pl-5 mt-1">
                        {area.keyFindings.map((finding, idx) => (
                          <li key={idx}>{finding}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="mt-3">
                      <h5 className="font-medium">Research Gaps</h5>
                      <ul className="list-disc pl-5 mt-1">
                        {area.researchGaps.map((gap, idx) => (
                          <li key={idx}>{gap}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </section>

              <section>
                <h3 className="text-xl font-semibold mb-4">Research Gaps & Future Studies</h3>
                <ul className="list-disc pl-5">
                  {review.researchGaps.questions.map((question, index) => (
                    <li key={index}>{question}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-xl font-semibold mb-4">Conclusion</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold">Key Points</h4>
                    <ul className="list-disc pl-5 mt-2">
                      {review.conclusion.keyPoints.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold">Target Audience</h4>
                    <ul className="list-disc pl-5 mt-2">
                      {review.conclusion.targetAudience.map((audience, index) => (
                        <li key={index}>{audience}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold">Safety Considerations</h4>
                    <ul className="list-disc pl-5 mt-2">
                      {review.conclusion.safetyConsiderations.map((safety, index) => (
                        <li key={index}>{safety}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
