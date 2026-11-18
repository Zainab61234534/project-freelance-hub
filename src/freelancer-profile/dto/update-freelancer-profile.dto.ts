import { PartialType } from '@nestjs/mapped-types';
import { CreateFreelancerProfileDto } from './create-freelancer-profile.dto.js';

export class UpdateFreelancerProfileDto extends PartialType(CreateFreelancerProfileDto) {}
