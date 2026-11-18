
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';

import { Type } from 'class-transformer';

export class CreateOfferDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999999999.99)
  price: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
