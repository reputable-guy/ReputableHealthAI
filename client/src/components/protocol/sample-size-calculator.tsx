import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface SampleSizeCalculatorProps {
  onCalculate: (params: {
    effectSize: number;
    power: number;
    alpha: number;
  }) => void;
  currentSampleSize: number;
}

export default function SampleSizeCalculator({ onCalculate, currentSampleSize }: SampleSizeCalculatorProps) {
  const [effectSize, setEffectSize] = useState(0.5);
  const [desiredPower, setDesiredPower] = useState(0.8);
  const [alpha, setAlpha] = useState(0.05);

  const handleChange = () => {
    onCalculate({
      effectSize,
      power: desiredPower,
      alpha,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Sample Size Calculator
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p>Adjust these parameters to calculate the required sample size for your study.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                Effect Size
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p>The expected magnitude of the intervention's impact:</p>
                      <ul className="list-disc list-inside mt-2 text-sm">
                        <li>Small: 0.2 (20%)</li>
                        <li>Medium: 0.5 (50%)</li>
                        <li>Large: 0.8 (80%)</li>
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </label>
              <span className="text-sm font-medium">{(effectSize * 100).toFixed(1)}%</span>
            </div>
            <Slider
              value={[effectSize * 100]}
              onValueChange={(value) => {
                setEffectSize(value[0] / 100);
                handleChange();
              }}
              min={10}
              max={100}
              step={5}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                Statistical Power
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p>The probability of detecting a true effect:</p>
                      <ul className="list-disc list-inside mt-2 text-sm">
                        <li>Minimum: 80%</li>
                        <li>Recommended: 90%</li>
                        <li>Optimal: 95%</li>
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </label>
              <span className="text-sm font-medium">{(desiredPower * 100).toFixed(1)}%</span>
            </div>
            <Slider
              value={[desiredPower * 100]}
              onValueChange={(value) => {
                setDesiredPower(value[0] / 100);
                handleChange();
              }}
              min={80}
              max={99}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                Significance Level (α)
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p>The probability of false positive results:</p>
                      <ul className="list-disc list-inside mt-2 text-sm">
                        <li>Standard: 5% (0.05)</li>
                        <li>Stringent: 1% (0.01)</li>
                        <li>Very Stringent: 0.1% (0.001)</li>
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </label>
              <span className="text-sm font-medium">{(alpha * 100).toFixed(1)}%</span>
            </div>
            <Slider
              value={[alpha * 100]}
              onValueChange={(value) => {
                setAlpha(value[0] / 100);
                handleChange();
              }}
              min={1}
              max={10}
              step={0.5}
            />
          </div>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Current Study Parameters:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Sample Size: {currentSampleSize} participants</li>
              <li>Effect Size: {(effectSize * 100).toFixed(1)}%</li>
              <li>Statistical Power: {(desiredPower * 100).toFixed(1)}%</li>
              <li>Significance Level: {(alpha * 100).toFixed(1)}%</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
