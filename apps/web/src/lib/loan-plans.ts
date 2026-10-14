export const LOAN_PLAN_IDS = ['AED_2000', 'AED_1000'] as const;
export type LoanPlanId = (typeof LOAN_PLAN_IDS)[number];

export const LOAN_PLANS: Record<
  LoanPlanId,
  {
    id: LoanPlanId;
    label: string;
    principal: number;
    totalPayable: number;
    defaultDaily: number;
  }
> = {
  AED_2000: {
    id: 'AED_2000',
    label: '2,000 AED plan',
    principal: 1800,
    totalPayable: 2000,
    defaultDaily: 100,
  },
  AED_1000: {
    id: 'AED_1000',
    label: '1,000 AED plan',
    principal: 800,
    totalPayable: 1000,
    defaultDaily: 100,
  },
};

export function loanTotals(loan?: {
  totalPayable?: string | number | null;
  principalAmount?: string | number | null;
}) {
  const principal = Number(loan?.principalAmount ?? 1800);
  const total = Math.max(Number(loan?.totalPayable ?? 2000), principal);
  return { principal, total };
}
