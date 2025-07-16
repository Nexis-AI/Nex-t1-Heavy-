import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Nex-t1 Heavy Multi-Agent System',
      version: '1.0.0',
    };
  }

  @Get('live')
  liveness() {
    return { status: 'live' };
  }

  @Get('ready')
  readiness() {
    return { status: 'ready' };
  }
}