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
  
  // Calculate minimum sample size based on power analysis
  const minimumSampleSize = calculateMinimumSampleSize({
    effectSize: 0.5, // medium effect size
    alpha: 0.05,
    power: 0.8,
    groups: protocol.studyType === "Randomized Controlled Trial" ? 2 : 1
  });

  // Validate participant count
  if (protocol.participantCount && protocol.participantCount < minimumSampleSize) {
    errors.push({
      field: 'participantCount',
      message: `Sample size too small. Minimum recommended: ${minimumSampleSize}`,
      severity: 'error'
    });
  }

  // Check control group design for RCTs
  if (protocol.studyType === "Randomized Controlled Trial") {
    if (!protocol.controlGroupDetails) {
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
    effectSize: 0.5,
    alpha: 0.05
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
