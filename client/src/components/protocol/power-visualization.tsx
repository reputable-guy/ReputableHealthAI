import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import { TooltipProvider, Tooltip as UITooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface PowerVisualizationProps {
  power: number;
  sampleSize: number;
  recommendedSize: number;
  effectSize: number;
  confidence: number;
  powerCurve: Array<{ sampleSize: number; power: number }>;
}

function getPowerColor(power: number): string {
  if (power >= 0.8) return "rgb(34, 197, 94)"; // green-500
  if (power >= 0.6) return "rgb(234, 179, 8)"; // yellow-500
  return "rgb(239, 68, 68)"; // red-500
}

function getPowerStatus(power: number): string {
  if (power >= 0.8) return "Adequate statistical power";
  if (power >= 0.6) return "Borderline statistical power";
  return "Insufficient statistical power";
}

export default function PowerVisualization({ 
  power, 
  sampleSize, 
  recommendedSize,
  effectSize,
  confidence,
  powerCurve 
}: PowerVisualizationProps) {
  const powerColor = getPowerColor(power);
  const powerStatus = getPowerStatus(power);
  const powerPercentage = power * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Statistical Power Analysis
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Statistical power indicates the probability of detecting a true effect.
                  <br />
                  • 80% or higher: Recommended
                  <br />
                  • 60-79%: Borderline
                  <br />
                  • Below 60%: Insufficient
                </p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: powerColor }}>
              {powerPercentage.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Power</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {(effectSize * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Effect Size</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {(confidence * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Confidence</div>
          </div>
        </div>

        <div className="h-[200px] w-full">
          <LineChart
            width={500}
            height={200}
            data={powerCurve}
            margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="sampleSize" 
              label={{ value: 'Sample Size', position: 'bottom' }}
            />
            <YAxis 
              label={{ value: 'Power', angle: -90, position: 'left' }}
              domain={[0, 1]}
              tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
            />
            <Tooltip 
              formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
              labelFormatter={(label) => `Sample Size: ${label}`}
            />
            <ReferenceLine y={0.8} stroke="red" strokeDasharray="3 3" />
            <Line 
              type="monotone" 
              dataKey="power" 
              stroke={powerColor} 
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Current Sample Size:</span>{" "}
            <span className={sampleSize >= recommendedSize ? "text-green-600" : "text-red-600"}>
              {sampleSize}
            </span>
          </div>
          <div>
            <span className="font-medium">Recommended Size:</span>{" "}
            <span>{recommendedSize}</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-sm text-muted-foreground"
        >
          {powerStatus}
          {power < 0.8 && (
            <div className="mt-2 text-red-600">
              Recommendation: Increase sample size to {recommendedSize} for adequate statistical power.
            </div>
          )}
        </motion.div>
      </CardContent>
    </Card>
  );
}