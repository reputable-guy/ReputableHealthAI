import { z } from "zod";
import type { ProtocolData } from "../../client/src/pages/protocol-designer";

// Statistical Power Analysis Requirements
const powerAnalysisSchema = z.object({
  effectSize: z.number().min(0).max(1),
  alpha: z.number().default(0.05),
  power: z.number().min(0.8).max(1),
  groups: z.number().min(1).max(10),
});

// Control Group Requirements
const controlGroupSchema = z.object({
  hasControlGroup: z.boolean(),
  controlType: z.enum(["placebo", "waitlist", "active", "none"]),
  controlGroupSize: z.number().min(1),
  randomizationMethod: z.enum(["simple", "blocked", "stratified"]),
});

// Regulatory Compliance Schema
const regulatorySchema = z.object({
  productCategory: z.enum(["supplement", "device", "lifestyle", "other"]),
  marketingClaims: z.array(z.string()),
  safetyChecks: z.array(z.string()),
  dataPrivacyMeasures: z.array(z.string()),
});

interface ValidationResult {
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

export async function validateStudyDesign(protocol: Partial<ProtocolData>): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const suggestions: string[] = [];
  const regulatoryFlags: RegulationFlag[] = [];
  
  // Calculate effect size based on study design
  const effectSize = calculateEffectSize(protocol);
  
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

  // Check control group design for RCTs
  if (protocol.studyType === "Randomized Controlled Trial") {
    if (!protocol.controlGroup) {
      errors.push({
        field: 'controlGroup',
        message: 'Control group details required for RCT',
        severity: 'error'
      });
    }
  }

  // Regulatory compliance checks
  const regulatoryIssues = checkRegulatoryCompliance(protocol);
  regulatoryFlags.push(...regulatoryIssues);

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

function calculateEffectSize(protocol: Partial<ProtocolData>): number {
  // Implement Cohen's d calculation based on protocol parameters
  // This is a simplified version - in production, use more sophisticated methods
  return 0.5; // Medium effect size
}

function calculateMinimumSampleSize(params: {
  effectSize: number;
  alpha: number;
  power: number;
  groups: number;
}): number {
  // Implementation using power analysis formulas
  const minPerGroup = Math.ceil((16 / (params.effectSize * params.effectSize)));
  return minPerGroup * params.groups;
}

function calculateStatisticalPower(params: {
  sampleSize: number;
  effectSize: number;
  alpha: number;
}): number {
  const ncp = params.effectSize * Math.sqrt(params.sampleSize / 2);
  return Math.min(1, Math.max(0, (1 - params.alpha) * (1 - Math.exp(-ncp / 2))));
}

function calculateConfidenceLevel(params: {
  sampleSize: number;
  effectSize: number;
  power: number;
}): number {
  // Simplified confidence calculation
  return Math.min(0.99, Math.max(0.8, params.power * (1 - 1/Math.sqrt(params.sampleSize))));
}

function generatePowerCurve(params: {
  effectSize: number;
  alpha: number;
  maxSampleSize: number;
}): Array<{ sampleSize: number; power: number }> {
  const curve: Array<{ sampleSize: number; power: number }> = [];
  const steps = 20;
  const stepSize = params.maxSampleSize / steps;

  for (let i = 1; i <= steps; i++) {
    const sampleSize = Math.round(i * stepSize);
    const power = calculateStatisticalPower({
      sampleSize,
      effectSize: params.effectSize,
      alpha: params.alpha
    });
    curve.push({ sampleSize, power });
  }

  return curve;
}

function checkRegulatoryCompliance(protocol: Partial<ProtocolData>): RegulationFlag[] {
  const flags: RegulationFlag[] = [];

  // FTC Compliance Checks
  if (protocol.studyGoal === "marketing") {
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
