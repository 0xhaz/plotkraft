import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { AuthGuard } from '../auth/auth.guard';
import { Uid } from '../auth/uid.decorator';
import { MembershipService } from '../auth/membership.service';

interface ImportBody {
  title?: string;
  source: string;
}

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly membership: MembershipService,
  ) {}

  /** Ownership comes from the verified token, never from the request body. */
  @Post('import')
  import(@Body() body: ImportBody, @Uid() uid: string) {
    return this.projects.importFountain({ ...body, ownerUid: uid });
  }

  @Get(':id')
  async get(@Param('id') id: string, @Uid() uid: string) {
    await this.membership.assertMember(id, uid);
    return this.projects.getProject(id);
  }
}
