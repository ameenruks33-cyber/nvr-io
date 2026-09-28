import { IsEmail, IsString, Matches, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class VerifyOtpDto {
  @IsString()
  @Matches(/^[a-z0-9]{10,40}$/i)
  challengeId!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code!: string;
}

export class DisableOtpDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
