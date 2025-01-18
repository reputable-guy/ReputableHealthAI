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

function generatePowerCurve({ effectSize, alpha, maxSampleSize }: { effectSize: number; alpha: number; maxSampleSize: number }): Array<{ sampleSize: number; power: number }> {
  const curve = [];
  for (let sampleSize = 1; sampleSize <= maxSampleSize; sampleSize++) {
    const power = calculateStatisticalPower({ sampleSize, effectSize, alpha });
    curve.push({ sampleSize, power });
  }
  return curve;
}

function calculateConfidenceLevel({ sampleSize, effectSize, power }: { sampleSize: number; effectSize: number; power: number }): number {
  //simplified confidence calculation
  return power * 100;
}


export async function validateStudyDesign(protocol: Partial<ProtocolData>): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const suggestions: string[] = [];
  const regulatoryFlags: RegulationFlag[] = [];

  // Calculate effect size based on study design
  const effectSize = 0.5; // Medium effect size

  // Calculate minimum sample size
  const minimumSampleSize = calculateMinimumSampleSize({
    effectSize,
    alpha: 0.05,
    power: 0.8,
    groups: protocol.studyType === "Randomized Controlled Trial" ? 2 : 1
  });

  // Generate power curve for visualization
  const powerCurve = generatePowerCurve({
    effectSize,
    alpha: 0.05,
    maxSampleSize: Math.max(minimumSampleSize * 2, protocol.participantCount || 0)
  });

  // Validate participant count
  if (!protocol.participantCount || protocol.participantCount < minimumSampleSize) {
    errors.push({
      field: 'participantCount',
      message: `Sample size too small. Minimum recommended: ${minimumSampleSize}`,
      severity: 'error'
    });
  }

  // Calculate statistical power
  const statisticalPower = calculateStatisticalPower({
    sampleSize: protocol.participantCount || 0,
    effectSize,
    alpha: 0.05
  });

  // Calculate confidence level
  const confidence = calculateConfidenceLevel({
    sampleSize: protocol.participantCount || 0,
    effectSize,
    power: statisticalPower
  });

  // Generate suggestions for improvement
  if (statisticalPower < 0.8) {
    suggestions.push(`Increase sample size to improve statistical power (current: ${(statisticalPower * 100).toFixed(1)}%)`);
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
    powerCurve,
    regulatoryFlags
  };
}

function calculateMinimumSampleSize(params: {
  effectSize: number;
  alpha: number;
  power: number;
  groups: number;
}): number {
  // Basic implementation using Cohen's d formula
  // For more accurate results, we would use a proper stats library
  const minPerGroup = Math.ceil((16 / (params.effectSize * params.effectSize)));
  return minPerGroup * params.groups;
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