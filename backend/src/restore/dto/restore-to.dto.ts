import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class RestoreToDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD' })
  date!: string;

  @Transform(({ value }) => String(value || '').slice(0, 5))
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Time must be HH:mm' })
  time!: string;
}
