import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

export class RestoreToDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD' })
  date!: string;

  @Transform(({ value }) => String(value || '').slice(0, 5))
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Time must be HH:mm' })
  time!: string;

  @IsOptional()
  @Transform(({ value }) => {
    const id = String(value || '').trim();
    return id || undefined;
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{8,64}$/, { message: 'Invalid person' })
  customerId?: string;
}
