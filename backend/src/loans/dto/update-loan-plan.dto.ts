import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { LOAN_PLAN_IDS, type LoanPlanId } from '../loan-plans';

export class UpdateLoanPlanDto {
  @IsIn(LOAN_PLAN_IDS)
  planId!: LoanPlanId;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  dailyPayment?: number;
}
