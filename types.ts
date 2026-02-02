
export interface GcdStep {
  n: number;
  m: number;
  remainder: number;
}

export interface GcdResult {
  steps: GcdStep[];
  gcd: number;
  n: number;
  m: number;
}
