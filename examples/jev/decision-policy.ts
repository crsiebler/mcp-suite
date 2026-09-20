import type { EvaluationOutput } from "../../servers/jev/src/output.js";

export interface DecisionPolicy {
  fallback: string;
  minimumProbability: number;
  minimumConfidence: number;
  minimumSupport: number;
}

/** Illustrative caller policy only: no dispatch, approval, file write or merge. */
export function chooseNextStep(
  result: EvaluationOutput,
  policy: DecisionPolicy
): string {
  const decision = result.answers.decision;
  const supported = result.answers.supported;
  if (decision?.type !== "choice" || supported?.type !== "boolean")
    return policy.fallback;
  const probability = decision.probabilities?.[decision.choice];
  const confidence = result.confidence?.decision;
  if (
    probability === undefined ||
    confidence === undefined ||
    probability < policy.minimumProbability ||
    confidence < policy.minimumConfidence ||
    supported.probability < policy.minimumSupport
  )
    return policy.fallback;
  return decision.choice;
}
