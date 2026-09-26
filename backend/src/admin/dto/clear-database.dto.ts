import { IsIn, IsString } from 'class-validator';

export class ClearDatabaseDto {
  @IsString()
  @IsIn(['DELETE_OLD_DATA'])
  confirmation!: string;
}
