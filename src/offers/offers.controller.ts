
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard.js';
import { OffersService } from './offers.service.js';
import { CreateOfferDto } from './dto/create-offer.dto.js';
import { CurrentUser } from '../common/decorator/current-user.decorator.js';
import { UpdateOfferDto } from './dto/update-offer.dto.js';


@Controller('offers')
@UseGuards(SessionAuthGuard)
export class OffersController {
  constructor(
    private readonly offersService: OffersService,
  ) {}

  // 1. Create a new offer
  @Post('projects/:projectId')
  create(
    @CurrentUser() user: { id: string; role: string },
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateOfferDto,
  ) {
    return this.offersService.create(
      user.id,
      user.role,
      projectId,
      dto,
    );
  }

  // 2. Get my offers (Freelancer)
  @Get('my')
  findMyOffers(
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.offersService.findMyOffers(
      user.id,
      user.role,
    );
  }

  // 3. Get offers for my project (Client)
  @Get('projects/:projectId')
  findProjectOffers(
    @CurrentUser() user: { id: string; role: string },
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.offersService.findProjectOffers(
      user.id,
      user.role,
      projectId,
    );
  }

  // 4. Update my offer
  @Patch(':offerId')
  update(
    @CurrentUser() user: { id: string; role: string },
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: UpdateOfferDto,
  ) {
    return this.offersService.update(
      user.id,
      user.role,
      offerId,
      dto,
    );
  }


  // 5. Accept an offer (Client)
  @Post('projects/:projectId/accept/:offerId')
  acceptOffer(
    @CurrentUser() user: { id: string; role: string },
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() body: { expectedPrice: number },
  ) {
    return this.offersService.acceptOffer(
      user.id,
      user.role,
      projectId,
      offerId,
      body.expectedPrice,
    );
  }

}
