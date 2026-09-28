import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  /** WhatsApp number used for login codes; empty string clears it. */
  @IsOptional()
  @IsString()
  @Matches(/^$|^\+?[\d\s-]{8,20}$/, { message: 'Enter a valid WhatsApp number' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  newPassword?: string;
}
