import {
  IsString,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

export class CreateDeliveryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileUrl: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;
}
