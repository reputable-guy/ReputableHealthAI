import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Info } from "lucide-react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import SampleSizeCalculator from "./sample-size-calculator";
import { useState, useEffect } from "react";

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
  onUpdateParameters: (params: {
    effectSize: number;
    power: number;
    alpha: number;
    calculatedSampleSize: number;
  }) => void;
}

export default function PowerVisualization({ 
  power, 
  sampleSize, 
  recommendedSize,
  effectSize,
  confidence,
  powerCurve,
  confidenceInterval,
  onUpdateParameters
}: PowerVisualizationProps) {
  const [currentSampleSize, setCurrentSampleSize] = useState(sampleSize);

  useEffect(() => {
    setCurrentSampleSize(sampleSize);
  }, [sampleSize]);

  const powerColor = power >= 0.8 
    ? "rgb(34, 197, 94)" // green-500
    : power >= 0.6 
    ? "rgb(234, 179, 8)" // yellow-500
    : "rgb(239, 68, 68)"; // red-500

  const handleCalculatorUpdate = (params: {
    effectSize: number;
    power: number;
    alpha: number;
    calculatedSampleSize: number;
  }) => {
    setCurrentSampleSize(params.calculatedSampleSize);
    onUpdateParameters(params);
  };

  return (
    <div className="space-y-6 p-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold" style={{ color: powerColor }}>
            {(power * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            Statistical Power
            <TooltipProvider delayDuration={0}>
              <UITooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center" className="max-w-xs">
                  <p>Statistical power is the probability of detecting a true effect when it exists.</p>
                  <ul className="list-disc list-inside mt-2 text-sm">
                    <li>≥80%: Good power</li>
                    <li>60-79%: Marginal power</li>
                    <li>&lt;60%: Insufficient power</li>
                  </ul>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold flex items-center justify-center gap-2">
            {(effectSize * 100).toFixed(1)}%
            <TooltipProvider delayDuration={0}>
              <UITooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center" className="max-w-xs">
                  <p>Effect size indicates the magnitude of the intervention's impact:</p>
                  <ul className="list-disc list-inside mt-2 text-sm">
                    <li>20%: Small effect</li>
                    <li>50%: Medium effect</li>
                    <li>80%: Large effect</li>
                  </ul>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
            {confidenceInterval && (
              <TooltipProvider delayDuration={0}>
                <UITooltip>
                  <TooltipTrigger>
                    <span className="text-sm text-muted-foreground">(±{((confidenceInterval.upper - confidenceInterval.lower) * 50).toFixed(1)}%)</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="center" className="max-w-xs">
                    <p>95% Confidence Interval:</p>
                    <p>{(confidenceInterval.lower * 100).toFixed(1)}% - {(confidenceInterval.upper * 100).toFixed(1)}%</p>
                    <p className="mt-2 text-sm">This means we are 95% confident that the true effect size falls within this range.</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="text-sm text-muted-foreground">Effect Size</div>
        </div>
        <div className="text-center">
          <motion.div 
            className="text-2xl font-bold"
            key={currentSampleSize}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {currentSampleSize}
          </motion.div>
          <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            Sample Size
            <TooltipProvider delayDuration={0}>
              <UITooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center" className="max-w-xs">
                  <p>The number of participants needed depends on:</p>
                  <ul className="list-disc list-inside mt-2 text-sm">
                    <li>Desired statistical power</li>
                    <li>Expected effect size</li>
                    <li>Significance level (α)</li>
                  </ul>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

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

      <div className="mt-6">
        <SampleSizeCalculator
          onCalculate={handleCalculatorUpdate}
          currentSampleSize={currentSampleSize}
        />
      </div>

      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="text-sm space-y-2">
          <h4 className="font-medium">Understanding Statistical Analysis:</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Statistical power ({(power * 100).toFixed(1)}%) indicates the likelihood of detecting a true effect in your study</li>
            <li>Higher power (≥80%) reduces the risk of false negative results</li>
            <li>Effect size ({(effectSize * 100).toFixed(1)}%) represents the expected magnitude of impact</li>
            {confidenceInterval && (
              <li>The 95% confidence interval ({(confidenceInterval.lower * 100).toFixed(1)}% - {(confidenceInterval.upper * 100).toFixed(1)}%) shows the range where we expect the true effect to fall</li>
            )}
          </ul>
        </div>

        <div className="text-sm space-y-2">
          <h4 className="font-medium">Study Design Recommendations:</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            {currentSampleSize < recommendedSize && (
              <li>Consider increasing your sample size to {recommendedSize} participants to achieve adequate power</li>
            )}
            <li>Your current design can detect effects of {(effectSize * 100).toFixed(1)}% or larger</li>
            <li>With {currentSampleSize} participants, you have {(power * 100).toFixed(1)}% power to detect the specified effect</li>
            {confidenceInterval && (
              <li>Your confidence interval width is {((confidenceInterval.upper - confidenceInterval.lower) * 100).toFixed(1)}% - {
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