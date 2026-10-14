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

export function resolveLoanAmounts(input: {
  planId?: LoanPlanId;
  principalAmount?: number;
  totalPayable?: number;
  dailyPayment?: number;
  defaults?: { principal: number; total: number; daily: number };
}) {
  const defaults = input.defaults ?? {
    principal: 1800,
    total: 2000,
    daily: 100,
  };

  if (input.planId && LOAN_PLANS[input.planId]) {
    const plan = LOAN_PLANS[input.planId];
    return {
      principal: plan.principal,
      totalPayable: plan.totalPayable,
      daily: input.dailyPayment ?? plan.defaultDaily,
    };
  }

  const principal = Number(input.principalAmount ?? defaults.principal);
  const totalPayable = Math.max(
    Number(input.totalPayable ?? defaults.total),
    principal,
  );
  const daily = Number(input.dailyPayment ?? defaults.daily);

  return { principal, totalPayable, daily };
}
