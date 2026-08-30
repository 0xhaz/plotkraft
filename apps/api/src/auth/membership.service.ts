import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class MembershipService {
  constructor(private readonly fb: FirebaseService) {}

  /**
   * Throws unless `uid` is a member of the project.
   *
   * Every project-scoped route calls this. Agent routes especially: an
   * unauthenticated caller who knows a project id could otherwise run repeated
   * Vertex and Parallel passes on someone else's script.
   */
  async assertMember(projectId: string, uid: string): Promise<void> {
    const doc = await this.fb.db.collection('projects').doc(projectId).get();
    if (!doc.exists) throw new NotFoundException(`No project ${projectId}`);

    const members = (doc.data()?.memberUids as string[]) ?? [];
    if (!members.includes(uid)) {
      throw new ForbiddenException('Not a member of this project');
    }
  }
}
