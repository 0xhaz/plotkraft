import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { CausalityService } from './causality.service';
import { GeminiService } from './gemini.service';
import { WhatIfService } from './what-if.service';
import { ResearcherService } from './researcher.service';
import { ParallelService } from './parallel.service';
import { StoryCircleService } from './story-circle.service';
import { NotesService } from './notes.service';
import { CraftService } from './craft.service';

@Module({
  controllers: [AgentsController],
  providers: [GeminiService, CausalityService, WhatIfService, ParallelService, ResearcherService, StoryCircleService, NotesService, CraftService],
  exports: [GeminiService, CausalityService, WhatIfService, ParallelService, ResearcherService, StoryCircleService, NotesService, CraftService],
})
export class AgentsModule {}
