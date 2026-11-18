
import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class ReviewDeliveryDto {
  @IsIn(['APPROVED', 'REVISION_REQUESTED'])
  status: 'APPROVED' | 'REVISION_REQUESTED';

  @ValidateIf((dto) => dto.status === 'REVISION_REQUESTED')
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reviewMessage?: string;
}
