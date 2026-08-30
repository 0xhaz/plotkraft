import { Controller, Get, Param, Post } from '@nestjs/common';
import { CausalityService } from './causality.service';
import { GeminiService } from './gemini.service';

@Controller('projects/:id/agents')
export class AgentsController {
  constructor(
    private readonly causality: CausalityService,
    private readonly gemini: GeminiService,
  ) {}

  /** Which agents can actually run right now — surfaced so the UI never fakes readiness. */
  @Get('status')
  status() {
    return {
      gemini: this.gemini.configured,
      parallel: Boolean(process.env.PARALLEL_API_KEY),
    };
  }

  @Post('causality')
  runCausality(@Param('id') id: string) {
    return this.causality.analyze(id);
  }
}
