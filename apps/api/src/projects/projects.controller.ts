import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ProjectsService } from './projects.service';

interface ImportBody {
  title?: string;
  source: string;
  ownerUid: string;
}

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post('import')
  import(@Body() body: ImportBody) {
    return this.projects.importFountain(body);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.projects.getProject(id);
  }
}
