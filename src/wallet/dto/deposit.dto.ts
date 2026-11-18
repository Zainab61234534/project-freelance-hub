
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsPositive,
  Max,
} from 'class-validator';

export class DepositDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1000000)
  amount: number;
}
