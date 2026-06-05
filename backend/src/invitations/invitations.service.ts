import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Serwis zaproszen
@Injectable()
export class InvitationsService {
  constructor(private prisma: PrismaService) {}

  // Tworzenie zaproszenia
  async invite(workspaceId: string, email: string, invitedById: string) {
    return this.prisma.invitation.create({
      data: { workspaceId, email, invitedById },
    });
  }

  // Pobieranie zaproszen
  async getMyInvitations(email: string) {
    return this.prisma.invitation.findMany({
      where: { email, status: 'PENDING' },
      include: { workspace: true, invitedBy: true },
    });
  }

  // Akceptowanie zaproszenia
  async acceptInvitation(invitationId: string, userId: string) {
    const inv = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
    });
    if (!inv) throw new Error('Zaproszenie nie istnieje');

    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: inv.workspaceId,
        userId: userId,
        role: 'MEMBER',
      },
    });

    return this.prisma.invitation.delete({ where: { id: invitationId } });
  }
}

