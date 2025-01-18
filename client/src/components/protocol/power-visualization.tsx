import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface PowerVisualizationProps {
  power: number;  // between 0 and 1
  sampleSize: number;
  recommendedSize: number;
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

export default function PowerVisualization({ power, sampleSize, recommendedSize }: PowerVisualizationProps) {
  const powerColor = getPowerColor(power);
  const powerStatus = getPowerStatus(power);
  const powerPercentage = power * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Statistical Power Analysis</h4>
        <TooltipProvider>
          <Tooltip>
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
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="relative h-32 w-full">
        <svg className="w-full h-full">
          {/* Background arc */}
          <motion.path
            d="M 50 100 A 50 50 0 1 1 150 100"
            fill="none"
            stroke="rgb(229, 231, 235)"
            strokeWidth="12"
            strokeLinecap="round"
            className="absolute"
          />
          
          {/* Power indicator arc */}
          <motion.path
            d="M 50 100 A 50 50 0 1 1 150 100"
            fill="none"
            stroke={powerColor}
            strokeWidth="12"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: power }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />

          {/* Power percentage text */}
          <motion.text
            x="100"
            y="90"
            textAnchor="middle"
            className="text-2xl font-bold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {powerPercentage.toFixed(1)}%
          </motion.text>

          {/* Status text */}
          <motion.text
            x="100"
            y="110"
            textAnchor="middle"
            className="text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {powerStatus}
          </motion.text>
        </svg>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span>Current Sample Size:</span>
          <span className={sampleSize >= recommendedSize ? "text-green-600" : "text-red-600"}>
            {sampleSize}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Recommended Size:</span>
          <span>{recommendedSize}</span>
        </div>
      </div>
    </div>
  );
}
