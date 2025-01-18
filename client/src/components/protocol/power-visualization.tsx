import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Info } from "lucide-react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PowerVisualizationProps {
  power: number;
  sampleSize: number;
  recommendedSize: number;
  effectSize: number;
  confidence: number;
  powerCurve: Array<{ sampleSize: number; power: number }>;
  confidenceInterval?: {
    lower: number;
    upper: number;
  };
}

export default function PowerVisualization({ 
  power, 
  sampleSize, 
  recommendedSize,
  effectSize,
  confidence,
  powerCurve,
  confidenceInterval 
}: PowerVisualizationProps) {
  const powerColor = power >= 0.8 
    ? "rgb(34, 197, 94)" // green-500
    : power >= 0.6 
    ? "rgb(234, 179, 8)" // yellow-500
    : "rgb(239, 68, 68)"; // red-500

  return (
    <div className="space-y-6 p-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold" style={{ color: powerColor }}>
            {(power * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-muted-foreground">Statistical Power</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">
            {(effectSize * 100).toFixed(1)}%
            {confidenceInterval && (
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger className="ml-1">
                    <Info className="h-4 w-4 inline-block text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>95% Confidence Interval:</p>
                    <p>{(confidenceInterval.lower * 100).toFixed(1)}% - {(confidenceInterval.upper * 100).toFixed(1)}%</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="text-sm text-muted-foreground">Effect Size</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">
            {(confidence * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-muted-foreground">Confidence Level</div>
        </div>
      </div>

      {/* Power Curve Visualization */}
      <div className="h-[300px] w-full">
        <LineChart
          width={600}
          height={300}
          data={powerCurve}
          margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="sampleSize" 
            label={{ value: 'Sample Size', position: 'bottom' }}
          />
          <YAxis 
            label={{ value: 'Statistical Power', angle: -90, position: 'left' }}
            domain={[0, 1]}
            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Tooltip 
            formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
            labelFormatter={(label) => `Sample Size: ${label}`}
          />
          <ReferenceLine y={0.8} stroke="red" strokeDasharray="3 3" label="Required Power (80%)" />
          <Line 
            type="monotone" 
            dataKey="power" 
            stroke={powerColor} 
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </div>

      {/* Educational Information */}
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="text-sm space-y-2">
          <h4 className="font-medium">Understanding the Analysis:</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Statistical power is the probability of detecting a true effect if one exists</li>
            <li>A power of 80% or higher is generally considered adequate for research</li>
            <li>Effect size ({(effectSize * 100).toFixed(1)}%) represents the expected magnitude of the intervention's impact</li>
            {confidenceInterval && (
              <li>95% confidence interval: {(confidenceInterval.lower * 100).toFixed(1)}% - {(confidenceInterval.upper * 100).toFixed(1)}% indicates the range where the true effect size likely falls</li>
            )}
            <li>The red line shows the minimum recommended power level (80%)</li>
          </ul>
        </div>

        <div className="text-sm space-y-2">
          <h4 className="font-medium">Recommendations:</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            {sampleSize < recommendedSize && (
              <li>Consider increasing your sample size to {recommendedSize} participants to achieve adequate power</li>
            )}
            <li>Current design will detect effects of {(effectSize * 100).toFixed(1)}% or larger</li>
            <li>With {sampleSize} participants, you have {(power * 100).toFixed(1)}% power to detect the specified effect</li>
            {confidenceInterval && (
              <li>The width of your confidence interval is {((confidenceInterval.upper - confidenceInterval.lower) * 100).toFixed(1)}% - {
                confidenceInterval.upper - confidenceInterval.lower > 0.3 
                  ? "consider increasing sample size for more precise estimates"
                  : "this indicates good precision"
              }</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}