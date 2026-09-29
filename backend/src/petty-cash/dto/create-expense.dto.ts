import { IsNumber, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateExpenseDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1_000_000)
  amount!: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD' })
  spentOn!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  purpose!: string;
}
