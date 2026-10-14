import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateExpenseDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1_000_000)
  amount!: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD' })
  spentOn!: string;

  /** Required for general expenses; optional note for customer cash. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  purpose?: string;

  /** Pay cash to this customer (separate from general expenses). */
  @IsOptional()
  @IsString()
  customerId?: string;
}
