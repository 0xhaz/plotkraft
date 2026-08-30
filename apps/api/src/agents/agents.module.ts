import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { CausalityService } from './causality.service';
import { GeminiService } from './gemini.service';
import { WhatIfService } from './what-if.service';
import { ResearcherService } from './researcher.service';
import { ParallelService } from './parallel.service';

@Module({
  controllers: [AgentsController],
  providers: [GeminiService, CausalityService, WhatIfService, ParallelService, ResearcherService],
  exports: [GeminiService, CausalityService, WhatIfService, ParallelService, ResearcherService],
})
export class AgentsModule {}
