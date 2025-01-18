import { z } from "zod";
import type { ProtocolData } from "@/pages/protocol-designer";

// Statistical Power Analysis Requirements
export const powerAnalysisSchema = z.object({
  effectSize: z.number().min(0).max(1),
  alpha: z.number().default(0.05),
  power: z.number().min(0.8).max(1),
  groups: z.number().min(1).max(10),
});

// Control Group Requirements
export const controlGroupSchema = z.object({
  hasControlGroup: z.boolean(),
  controlType: z.enum(["placebo", "waitlist", "active", "none"]),
  controlGroupSize: z.number().min(1),
  randomizationMethod: z.enum(["simple", "blocked", "stratified"]),
});

// Regulatory Compliance Schema
export const regulatorySchema = z.object({
  productCategory: z.enum(["supplement", "device", "lifestyle", "other"]),
  marketingClaims: z.array(z.string()),
  safetyChecks: z.array(z.string()),
  dataPrivacyMeasures: z.array(z.string()),
});

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  suggestions: string[];
  statisticalPower: number;
  minimumSampleSize: number;
  effectSize: number;
  confidence: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  powerCurve: Array<{ sampleSize: number; power: number }>;
  regulatoryFlags: RegulationFlag[];
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface RegulationFlag {
  type: 'FTC' | 'FDA';
  description: string;
  severity: 'high' | 'medium' | 'low';
}

function calculateConfidenceLevel(params: {
  sampleSize: number;
  effectSize: number;
  power: number;
}): number {
  // Calculate confidence level based on sample size and power
  // This should return a value between 0 and 1
  return Math.min(0.99, Math.max(0.8,
    params.power * (1 - 1 / Math.sqrt(params.sampleSize))));
}

function calculateConfidenceInterval(params: {
  sampleSize: number;
  effectSize: number;
  alpha: number;
}): { lower: number; upper: number } {
  // Calculate margin of error using standard error and critical value
  const standardError = Math.sqrt(1 / params.sampleSize);
  const criticalValue = 1.96; // 95% confidence level
  const marginOfError = criticalValue * standardError;

  // Calculate confidence interval
  return {
    lower: Math.max(0, params.effectSize - marginOfError),
    upper: Math.min(1, params.effectSize + marginOfError)
  };
}

export function calculateMinimumSampleSize(params: {
  effectSize: number;
  alpha: number;
  power: number;
  groups: number;
}): number {
  // Using more accurate sample size calculation formula
  const zAlpha = 1.96; // For alpha = 0.05
  const zBeta = -0.84; // For power = 0.80

  // Adjust z-scores based on input parameters
  if (params.alpha !== 0.05) {
    // Approximate z-scores for different alpha levels
    if (params.alpha === 0.01) zAlpha = 2.576;
    else if (params.alpha === 0.1) zAlpha = 1.645;
  }

  if (params.power !== 0.8) {
    // Approximate z-scores for different power levels
    if (params.power === 0.9) zBeta = -1.28;
    else if (params.power === 0.95) zBeta = -1.645;
  }

  // Calculate sample size per group
  const minPerGroup = Math.ceil(
    2 * Math.pow((zAlpha - zBeta) / params.effectSize, 2)
  );

  return minPerGroup * params.groups;
}

export async function validateStudyDesign(
  protocol: Partial<ProtocolData>,
  calculatorParams?: {
    effectSize: number;
    power: number;
    alpha: number;
  }
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const suggestions: string[] = [];
  const regulatoryFlags: RegulationFlag[] = [];

  // Use provided calculator parameters or defaults
  const effectSize = calculatorParams?.effectSize ?? 0.5;
  const power = calculatorParams?.power ?? 0.8;
  const alpha = calculatorParams?.alpha ?? 0.05;

  // Calculate minimum sample size with current parameters
  const minimumSampleSize = calculateMinimumSampleSize({
    effectSize,
    alpha,
    power,
    groups: protocol.studyType === "Randomized Controlled Trial" ? 2 : 1
  });

  // Generate power curve for visualization
  const powerCurve = generatePowerCurve({
    effectSize,
    alpha,
    maxSampleSize: Math.max(minimumSampleSize * 2, protocol.participantCount || 0)
  });

  // Calculate statistical power with current parameters
  const statisticalPower = calculateStatisticalPower({
    sampleSize: protocol.participantCount || 0,
    effectSize,
    alpha
  });

  // Calculate confidence level
  const confidence = calculateConfidenceLevel({
    sampleSize: protocol.participantCount || 0,
    effectSize,
    power: statisticalPower
  });

  // Calculate confidence interval
  const confidenceInterval = calculateConfidenceInterval({
    sampleSize: protocol.participantCount || 0,
    effectSize,
    alpha
  });

  // Validate participant count
  if (!protocol.participantCount || protocol.participantCount < minimumSampleSize) {
    errors.push({
      field: 'participantCount',
      message: `Sample size too small. Minimum recommended: ${minimumSampleSize}`,
      severity: 'error'
    });
  }

  // Generate suggestions for improvement
  if (statisticalPower < 0.8) {
    suggestions.push(`Increase sample size to improve statistical power (current: ${(statisticalPower * 100).toFixed(1)}%)`);
  }

  if (confidenceInterval.upper - confidenceInterval.lower > 0.3) {
    suggestions.push(`Consider increasing sample size to narrow confidence interval (current width: ${((confidenceInterval.upper - confidenceInterval.lower) * 100).toFixed(1)}%)`);
  }

  // Check control group design for RCTs
  if (protocol.studyType === "Randomized Controlled Trial" && !protocol.controlGroup) {
    errors.push({
      field: 'controlGroup',
      message: 'Control group details required for RCT',
      severity: 'error'
    });
  }

  // Regulatory compliance checks
  const regulatoryIssues = checkRegulatoryCompliance(protocol);
  regulatoryFlags.push(...regulatoryIssues);

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    suggestions,
    statisticalPower,
    minimumSampleSize,
    effectSize,
    confidence,
    confidenceInterval,
    powerCurve,
    regulatoryFlags
  };
}

function calculateStatisticalPower(params: {
  sampleSize: number;
  effectSize: number;
  alpha: number;
}): number {
  // Simplified power calculation
  // In production, use a proper statistical library
  const ncp = params.effectSize * Math.sqrt(params.sampleSize / 2);
  // This is a rough approximation
  return Math.min(1, Math.max(0, (1 - params.alpha) * (1 - Math.exp(-ncp / 2))));
}

function generatePowerCurve({ effectSize, alpha, maxSampleSize }: { effectSize: number; alpha: number; maxSampleSize: number }): Array<{ sampleSize: number; power: number }> {
  const curve = [];
  const steps = 20;
  const stepSize = maxSampleSize / steps;

  for (let i = 1; i <= steps; i++) {
    const sampleSize = Math.round(i * stepSize);
    const power = calculateStatisticalPower({
      sampleSize,
      effectSize,
      alpha
    });
    curve.push({ sampleSize, power });
  }

  return curve;
}

function checkRegulatoryCompliance(protocol: Partial<ProtocolData>): RegulationFlag[] {
  const flags: RegulationFlag[] = [];

  // FTC Compliance Checks
  if (protocol.studyType === "Marketing") {
    flags.push({
      type: 'FTC',
      description: 'Marketing studies require clear disclosure of sponsorship',
      severity: 'high'
    });
  }

  // FDA Compliance Checks
  if (protocol.productName?.toLowerCase().includes('supplement')) {
    flags.push({
      type: 'FDA',
      description: 'Dietary supplement claims must be supported by scientific evidence',
      severity: 'high'
    });
  }

  return flags;
}