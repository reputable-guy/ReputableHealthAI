import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface InitialSetupFormProps {
  onComplete: (data: { productName: string; websiteUrl: string; studyGoal: string }) => void;
}

const STUDY_GOALS = [
  {
    value: "product_validation",
    label: "Product Validation & Efficacy Testing",
  },
  {
    value: "marketing_claims",
    label: "Marketing Claims Substantiation",
  },
  {
    value: "regulatory_compliance",
    label: "Regulatory Compliance",
  },
  {
    value: "product_optimization",
    label: "Product Optimization & Development",
  },
  {
    value: "competitive_analysis",
    label: "Competitive Analysis & Benchmarking",
  },
  {
    value: "consumer_research",
    label: "Consumer Research & Feedback",
  }
];

export default function InitialSetupForm({ onComplete }: InitialSetupFormProps) {
  const [productName, setProductName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [studyGoal, setStudyGoal] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete({ 
      productName, 
      websiteUrl, 
      studyGoal: STUDY_GOALS.find(goal => goal.value === studyGoal)?.label || studyGoal 
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="productName">Product Name</Label>
          <Input
            id="productName"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Enter product name"
            required
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

        <div className="space-y-2">
          <Label htmlFor="studyGoal">Study Goal</Label>
          <Select
            value={studyGoal}
            onValueChange={setStudyGoal}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select the primary goal of this study" />
            </SelectTrigger>
            <SelectContent>
              {STUDY_GOALS.map((goal) => (
                <SelectItem key={goal.value} value={goal.value}>
                  {goal.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" className="w-full" disabled={!productName || !studyGoal}>
          Generate Research Hypotheses
        </Button>
      </div>
    </form>
  );
}