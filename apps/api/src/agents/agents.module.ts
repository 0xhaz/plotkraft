import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { CausalityService } from './causality.service';
import { GeminiService } from './gemini.service';

@Module({
  controllers: [AgentsController],
  providers: [GeminiService, CausalityService],
  exports: [GeminiService, CausalityService],
})
export class AgentsModule {}
