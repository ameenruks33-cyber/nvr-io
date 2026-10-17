import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { LOAN_PLAN_IDS, type LoanPlanId } from '../loan-plans';

function toBool(value: unknown) {
  if (value === false || value === 'false' || value === 0 || value === '0') {
    return false;
  }
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true;
  }
  return value;
}

export class RenewPlanDto {
  @IsIn(LOAN_PLAN_IDS)
  planId!: LoanPlanId;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  dailyPayment?: number;

  /** Collect leftover cash on the current plan so it can close. Default true. */
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  settleRemaining?: boolean;

  /** Take the new plan cash out of the wallet. Default true. */
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  recordCashGiven?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}
