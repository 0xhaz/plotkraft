import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Uid } from '../auth/uid.decorator';
import { MembershipService } from '../auth/membership.service';
import { CausalityService } from './causality.service';
import { GeminiService } from './gemini.service';
import { WhatIfService } from './what-if.service';
import { ResearcherService } from './researcher.service';
import { ParallelService } from './parallel.service';
import { StoryCircleService } from './story-circle.service';
import { NotesService } from './notes.service';
import { CraftService } from './craft.service';
import { SequencesService } from './sequences.service';
import { ContinuityService } from './continuity.service';
import { PrevizService } from './previz.service';
import type { NoteSource } from './notes';

@Controller('projects/:id/agents')
@UseGuards(AuthGuard)
export class AgentsController {
  constructor(
    private readonly causality: CausalityService,
    private readonly gemini: GeminiService,
    private readonly whatIf: WhatIfService,
    private readonly researcher: ResearcherService,
    private readonly parallelSvc: ParallelService,
    private readonly circle: StoryCircleService,
    private readonly notes: NotesService,
    private readonly membership: MembershipService,
    private readonly craft: CraftService,
    private readonly sequences: SequencesService,
    private readonly continuity: ContinuityService,
    private readonly previz: PrevizService,
  ) {}

  /** Which agents can actually run right now — surfaced so the UI never fakes readiness. */
  @Get('status')
  status(@Param('id') _id: string) {
    return {
      gemini: this.gemini.configured,
      backend: this.gemini.backend,
      parallel: this.parallelSvc.configured,
    };
  }

  @Post('causality')
  async runCausality(@Param('id') id: string, @Uid() uid: string) {
    await this.membership.assertMember(id, uid);
    return this.causality.analyze(id);
  }

  @Post('story-circle')
  async runCircle(@Param('id') id: string, @Uid() uid: string) {
    await this.membership.assertMember(id, uid);
    return this.circle.analyze(id);
  }

  /** Paste a batch of notes from one sender; splitting happens in the agent pass. */
  @Post('notes')
  async addNotes(
    @Param('id') id: string,
    @Body() body: { source: NoteSource; author: string; body: string },
    @Uid() uid: string,
  ) {
    await this.membership.assertMember(id, uid);
    return this.notes.ingest(id, body);
  }

  @Post('notes/reconcile')
  async reconcileNotes(@Param('id') id: string, @Uid() uid: string) {
    await this.membership.assertMember(id, uid);
    return this.notes.reconcile(id);
  }

  /** Reference screenplays only: what each scene does and how. */
  @Post('craft')
  async runCraft(@Param('id') id: string, @Uid() uid: string) {
    await this.membership.assertMember(id, uid);
    return this.craft.analyze(id);
  }

  /** Divide the script into named sequences: the rung between act and scene. */
  @Post('sequences')
  async runSequences(@Param('id') id: string, @Uid() uid: string) {
    await this.membership.assertMember(id, uid);
    return this.sequences.analyze(id);
  }

  /** Build the script bible and flag later scenes that contradict it. */
  @Post('continuity')
  async runContinuity(@Param('id') id: string, @Uid() uid: string) {
    await this.membership.assertMember(id, uid);
    return this.continuity.analyze(id);
  }

  /** Storyboard panels for the scenes the agents say carry the film. */
  @Post('boards')
  async runBoards(
    @Param('id') id: string,
    @Body()
    body: {
      panels?: number;
      /** Board exactly these scenes, in order. */
      sceneIds?: string[];
      /** Or spread the panel budget across one act. */
      act?: number;
      fromIndex?: number;
      toIndex?: number;
    },
    @Uid() uid: string,
  ) {
    await this.membership.assertMember(id, uid);
    return this.previz.generate(id, body ?? {});
  }

  @Post('research')
  async runResearch(@Param('id') id: string, @Uid() uid: string) {
    await this.membership.assertMember(id, uid);
    return this.researcher.analyze(id);
  }

  /** Read-only: simulates a cut without touching the shared canvas. */
  @Post('what-if')
  async runWhatIf(
    @Param('id') id: string,
    @Body() body: { removedSceneIds: string[] },
    @Uid() uid: string,
  ) {
    await this.membership.assertMember(id, uid);
    return this.whatIf.simulate(id, body.removedSceneIds ?? []);
  }
}
