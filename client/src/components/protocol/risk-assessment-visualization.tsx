import { RiskAssessment } from "@/pages/protocol-designer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle, AlertOctagon } from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

interface RiskAssessmentVisualizationProps {
  assessment: RiskAssessment;
}

export default function RiskAssessmentVisualization({
  assessment,
}: RiskAssessmentVisualizationProps) {
  const chartData = [
    {
      category: "Participant Safety",
      score: assessment.categories.participantSafety,
    },
    {
      category: "Data Privacy",
      score: assessment.categories.dataPrivacy,
    },
    {
      category: "Ethical Considerations",
      score: assessment.categories.ethicalConsiderations,
    },
    {
      category: "Regulatory Compliance",
      score: assessment.categories.regulatoryCompliance,
    },
    {
      category: "Study Design",
      score: assessment.categories.studyDesign,
    },
  ];

  const getRiskIcon = () => {
    switch (assessment.riskLevel) {
      case "Low":
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case "Moderate":
        return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
      case "High":
        return <AlertOctagon className="h-6 w-6 text-red-500" />;
    }
  };

  const getRiskColor = () => {
    switch (assessment.riskLevel) {
      case "Low":
        return "bg-green-50 border-green-200";
      case "Moderate":
        return "bg-yellow-50 border-yellow-200";
      case "High":
        return "bg-red-50 border-red-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className={`p-4 rounded-lg border ${getRiskColor()}`}>
        <div className="flex items-center gap-2">
          {getRiskIcon()}
          <div>
            <h3 className="font-semibold">
              Overall Risk Level: {assessment.riskLevel}
            </h3>
            <p className="text-sm text-muted-foreground">
              Score: {assessment.overallScore}/100
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Risk Assessment Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" />
                  <Radar
                    name="Risk Score"
                    dataKey="score"
                    stroke="#2563eb"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {assessment.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-1">•</span>
                  <span className="text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
