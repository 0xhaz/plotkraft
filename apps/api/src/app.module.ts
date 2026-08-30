import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { FirebaseModule } from './firebase/firebase.module';
import { ProjectsModule } from './projects/projects.module';
import { AgentsModule } from './agents/agents.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule, ProjectsModule, AgentsModule],
  controllers: [HealthController],
})
export class AppModule {}
