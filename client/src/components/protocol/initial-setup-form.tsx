import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface InitialSetupFormProps {
  onComplete: (data: { productName: string; websiteUrl: string; studyGoal: string }) => void;
}

export default function InitialSetupForm({ onComplete }: InitialSetupFormProps) {
  const [productName, setProductName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [studyGoal, setStudyGoal] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete({ productName, websiteUrl, studyGoal });
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
          <Textarea
            id="studyGoal"
            value={studyGoal}
            onChange={(e) => setStudyGoal(e.target.value)}
            placeholder="What is the primary goal of this study? (e.g., marketing, regulatory compliance, product optimization)"
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={!productName || !studyGoal}>
          Generate Research Hypotheses
        </Button>
      </div>
    </form>
  );
}
