import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { DisableOtpDto, LoginDto, RefreshDto, VerifyOtpDto } from './dto/auth.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser, AuthUser } from './decorators/current-user.decorator';

const OTP_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(OTP_THROTTLE)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, req.ip);
  }

  @Public()
  @Throttle(OTP_THROTTLE)
  @Post('login/verify')
  verifyLogin(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.auth.verifyLoginOtp(dto, req.ip);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
  ) {
    return this.auth.updateProfile(user.id, dto, req.ip);
  }

  @Throttle(OTP_THROTTLE)
  @Post('otp/start')
  startOtp(@CurrentUser() user: AuthUser) {
    return this.auth.startOtpEnable(user.id);
  }

  @Throttle(OTP_THROTTLE)
  @Post('otp/confirm')
  confirmOtp(
    @CurrentUser() user: AuthUser,
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
  ) {
    return this.auth.confirmOtpEnable(user.id, dto, req.ip);
  }

  @Throttle(OTP_THROTTLE)
  @Post('otp/disable')
  disableOtp(
    @CurrentUser() user: AuthUser,
    @Body() dto: DisableOtpDto,
    @Req() req: Request,
  ) {
    return this.auth.disableOtp(user.id, dto.password, req.ip);
  }

  @Post('logout')
  logout(
    @CurrentUser() user: AuthUser,
    @Body() body: RefreshDto,
    @Req() req: Request,
  ) {
    return this.auth.logout(user.id, body.refreshToken, req.ip);
  }
}
