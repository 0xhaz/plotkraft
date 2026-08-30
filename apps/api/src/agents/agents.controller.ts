import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CausalityService } from './causality.service';
import { GeminiService } from './gemini.service';
import { WhatIfService } from './what-if.service';
import { ResearcherService } from './researcher.service';
import { ParallelService } from './parallel.service';

@Controller('projects/:id/agents')
export class AgentsController {
  constructor(
    private readonly causality: CausalityService,
    private readonly gemini: GeminiService,
    private readonly whatIf: WhatIfService,
    private readonly researcher: ResearcherService,
    private readonly parallelSvc: ParallelService,
  ) {}

  /** Which agents can actually run right now — surfaced so the UI never fakes readiness. */
  @Get('status')
  status() {
    return {
      gemini: this.gemini.configured,
      backend: this.gemini.backend,
      parallel: this.parallelSvc.configured,
    };
  }

  @Post('causality')
  runCausality(@Param('id') id: string) {
    return this.causality.analyze(id);
  }

  @Post('research')
  runResearch(@Param('id') id: string) {
    return this.researcher.analyze(id);
  }

  /** Read-only: simulates a cut without touching the shared canvas. */
  @Post('what-if')
  runWhatIf(@Param('id') id: string, @Body() body: { removedSceneIds: string[] }) {
    return this.whatIf.simulate(id, body.removedSceneIds ?? []);
  }
}
