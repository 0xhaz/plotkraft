import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { FirebaseModule } from './firebase/firebase.module';
import { ProjectsModule } from './projects/projects.module';
import { AgentsModule } from './agents/agents.module';

@Module({
  imports: [ConfigModule.forRoot({
      isGlobal: true,
      // Resolve relative to the compiled bundle, so the API picks up its own
      // .env whether it is started from the package or the workspace root.
      envFilePath: [join(__dirname, '..', '.env')],
    }), FirebaseModule, ProjectsModule, AgentsModule],
  controllers: [HealthController],
})
export class AppModule {}
