import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  careOfName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  careOfPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  botimNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobileNumber?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(30)
  passportNumber!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  aadhaarNumber!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  locationAccuracy?: number;

  @IsOptional()
  @IsString()
  consentVersion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  principalAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  dailyPayment?: number;
}
