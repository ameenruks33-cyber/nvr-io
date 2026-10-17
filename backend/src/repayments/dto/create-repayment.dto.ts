import { Transform, Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateRepaymentDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD' })
  collectedDate?: string;

  @IsOptional()
  @Transform(({ value }) => String(value || '').slice(0, 5))
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Time must be HH:mm' })
  collectedTime?: string;
}
