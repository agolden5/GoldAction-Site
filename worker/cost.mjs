// USD in millionths of a dollar. Reserve above the documented Haiku 5.5
// higher-tier price for the allowed usage (4,096 × $0.50/M + 256 × $2.50/M).
export const MONTHLY_BUDGET_MICROS = 5_000_000;
export const ATTEMPT_RESERVE_MICROS = 4_000;
export const MAX_COUNTED_INPUT_TOKENS = 2_048;
export const MAX_BILLED_INPUT_TOKENS = 4_096;
export const MAX_OUTPUT_TOKENS = 256;
