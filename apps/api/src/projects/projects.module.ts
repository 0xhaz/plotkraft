import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { PdfService } from '../ingest/pdf.service';

@Module({ controllers: [ProjectsController], providers: [ProjectsService, PdfService] })
export class ProjectsModule {}
