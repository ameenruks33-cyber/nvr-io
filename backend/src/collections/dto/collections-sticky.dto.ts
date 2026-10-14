import { IsString, MaxLength } from 'class-validator';

export class CollectionsStickyDto {
  @IsString()
  @MaxLength(1000)
  text!: string;
}
