import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { CausalityService } from './causality.service';
import { GeminiService } from './gemini.service';
import { WhatIfService } from './what-if.service';

@Module({
  controllers: [AgentsController],
  providers: [GeminiService, CausalityService, WhatIfService],
  exports: [GeminiService, CausalityService, WhatIfService],
})
export class AgentsModule {}
