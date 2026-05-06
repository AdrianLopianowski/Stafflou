import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class WorkspacesService {
  constructor(private prisma: PrismaService) {}

  create(createWorkspaceDto: CreateWorkspaceDto) {
    return this.prisma.workspace.create({
      data: {
        name: createWorkspaceDto.name,
        members: {
          create: {
            userId: createWorkspaceDto.userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: true,
      },
    });
  }

  findAllForUser(userId: string) {
    return this.prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        members: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.workspace.findUnique({
      where: { id },
      include: { members: true },
    });
  }

  update(id: string, updateWorkspaceDto: UpdateWorkspaceDto) {
    return this.prisma.workspace.update({
      where: { id },
      data: updateWorkspaceDto,
    });
  }

  remove(id: string) {
    return this.prisma.workspace.delete({
      where: { id },
    });
  }

  async getChannels(workspaceId: string) {
    return this.prisma.channel.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createChannel(
    workspaceId: string,
    name: string,
    type: 'TEXT' | 'INFO',
    userId: string,
  ) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!member) throw new Error('Brak uprawnień do tworzenia kanałów');

    return this.prisma.channel.create({
      data: {
        name,
        type,
        workspaceId,
      },
    });
  }

  async getMessages(channelId: string) {
    const prismaAny = this.prisma as any;
    const messages = await prismaAny.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: true,
        reactions: { include: { user: true } },
      },
    });

    return messages.map((msg: any) => ({
      ...msg,
      user: {
        ...msg.user,
        name:
          msg.user?.firstName && msg.user?.lastName
            ? `${msg.user.firstName} ${msg.user.lastName}`
            : msg.user?.name || msg.user?.email || 'Nieznany',
      },
    }));
  }

  async editMessage(
    workspaceId: string,
    messageId: string,
    content: string,
    requesterId: string,
  ) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: requesterId },
    });
    if (!member) throw new ForbiddenException('Brak dostępu');

    const prismaAny = this.prisma as any;
    const message = await prismaAny.message.findUnique({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Wiadomość nie istnieje');
    if (message.userId !== requesterId)
      throw new ForbiddenException('Możesz edytować tylko własne wiadomości');
    if (!message.content)
      throw new ForbiddenException('Nie można edytować wiadomości z plikiem');

    const updated = await prismaAny.message.update({
      where: { id: messageId },
      data: { content, isEdited: true },
      include: { user: true, reactions: { include: { user: true } } },
    });

    return {
      ...updated,
      user: {
        ...updated.user,
        name:
          updated.user?.firstName && updated.user?.lastName
            ? `${updated.user.firstName} ${updated.user.lastName}`
            : updated.user?.name || updated.user?.email || 'Nieznany',
      },
    };
  }

  async toggleReaction(
    workspaceId: string,
    messageId: string,
    emoji: string,
    userId: string,
  ) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!member) throw new ForbiddenException('Brak dostępu');

    const prismaAny = this.prisma as any;
    const existing = await prismaAny.reaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    if (existing) {
      await prismaAny.reaction.delete({ where: { id: existing.id } });
      return { removed: true };
    } else {
      await prismaAny.reaction.create({ data: { messageId, userId, emoji } });
      return { added: true };
    }
  }

  async getMembers(workspaceId: string) {
    const prismaAny = this.prisma as any;
    const members = await prismaAny.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true, customRole: true },
      orderBy: { joinedAt: 'asc' },
    });
    return members.map((m: any) => ({
      ...m,
      user: {
        ...m.user,
        displayName:
          m.user?.firstName && m.user?.lastName
            ? `${m.user.firstName} ${m.user.lastName}`
            : m.user?.email || 'Nieznany',
      },
    }));
  }

  async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    newRole: 'OWNER' | 'ADMIN' | 'MEMBER',
    requesterId: string,
  ) {
    const requester = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: requesterId },
    });
    if (!requester || !['OWNER', 'ADMIN'].includes(requester.role)) {
      throw new ForbiddenException('Brak uprawnień');
    }

    const target = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUserId },
    });
    if (!target) throw new NotFoundException('Użytkownik nie jest członkiem');

    if (requester.role === 'ADMIN' && target.role === 'OWNER') {
      throw new ForbiddenException('Nie możesz zmienić roli właściciela');
    }
    if (requester.role === 'ADMIN' && newRole === 'OWNER') {
      throw new ForbiddenException(
        'Tylko właściciel może nadać rolę właściciela',
      );
    }

    return this.prisma.workspaceMember.update({
      where: { id: target.id },
      data: { role: newRole },
      include: { user: true },
    });
  }

  async removeMember(
    workspaceId: string,
    targetUserId: string,
    requesterId: string,
  ) {
    const requester = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: requesterId },
    });
    if (!requester || !['OWNER', 'ADMIN'].includes(requester.role)) {
      throw new ForbiddenException('Brak uprawnień');
    }

    const target = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUserId },
    });
    if (!target) throw new NotFoundException('Użytkownik nie jest członkiem');

    if (
      requester.role === 'ADMIN' &&
      ['OWNER', 'ADMIN'].includes(target.role)
    ) {
      throw new ForbiddenException(
        'Brak uprawnień do usunięcia tego użytkownika',
      );
    }

    if (targetUserId === requesterId && target.role === 'OWNER') {
      const ownerCount = await this.prisma.workspaceMember.count({
        where: { workspaceId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException(
          'Nie możesz opuścić przestrzeni jako jedyny właściciel',
        );
      }
    }

    await this.prisma.workspaceMember.delete({ where: { id: target.id } });
    return { success: true };
  }

  async sendMessage(
    workspaceId: string,
    channelId: string,
    userId: string,
    content: string,
  ) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });

    if (!member) throw new Error('Brak dostępu do tej przestrzeni');

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (channel?.type === 'INFO' && member.role === 'MEMBER') {
      throw new Error(
        'Tylko Właściciel lub Admin może pisać na kanale informacyjnym.',
      );
    }
    const newMessage: any = await this.prisma.message.create({
      data: {
        content,
        channelId,
        userId,
      },
      include: {
        user: true,
      },
    });

    return {
      ...newMessage,
      user: {
        ...newMessage.user,
        name:
          newMessage.user?.firstName && newMessage.user?.lastName
            ? `${newMessage.user.firstName} ${newMessage.user.lastName}`
            : newMessage.user?.name || newMessage.user?.email || 'Nieznany',
      },
    };
  }

  async sendFileMessage(
    workspaceId: string,
    channelId: string,
    userId: string,
    fileUrl: string,
    fileName: string,
    fileType: string,
    content?: string,
  ) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!member) throw new ForbiddenException('Brak dostępu do tej przestrzeni');

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (channel?.type === 'INFO' && member.role === 'MEMBER') {
      throw new ForbiddenException(
        'Tylko Właściciel lub Admin może pisać na kanale informacyjnym.',
      );
    }

    const prismaAny = this.prisma as any;
    const newMessage: any = await prismaAny.message.create({
      data: {
        content: content || undefined,
        fileUrl,
        fileName,
        fileType,
        channelId,
        userId,
      },
      include: { user: true },
    });

    return {
      ...newMessage,
      user: {
        ...newMessage.user,
        name:
          newMessage.user?.firstName && newMessage.user?.lastName
            ? `${newMessage.user.firstName} ${newMessage.user.lastName}`
            : newMessage.user?.name || newMessage.user?.email || 'Nieznany',
      },
    };
  }

  async deleteMessage(
    workspaceId: string,
    messageId: string,
    requesterId: string,
  ) {
    const prismaAny = this.prisma as any;

    const requester = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: requesterId },
    });
    if (!requester) throw new ForbiddenException('Brak dostępu');

    const message: any = await prismaAny.message.findUnique({
      where: { id: messageId },
      include: { user: true, channel: true },
    });
    if (!message) throw new NotFoundException('Wiadomość nie istnieje');

    const isOwn = message.userId === requesterId;
    const isAdminOrOwner = ['OWNER', 'ADMIN'].includes(requester.role);

    if (!isOwn && !isAdminOrOwner) {
      throw new ForbiddenException('Brak uprawnień do usunięcia tej wiadomości');
    }

    if (!isOwn && isAdminOrOwner) {
      await prismaAny.deleteNotification.create({
        data: {
          userId: message.userId,
          workspaceId,
          channelName: message.channel.name,
          messagePreview:
            message.content?.substring(0, 100) || message.fileName || '',
          deletedByRole: requester.role,
        },
      });
    }

    if (message.fileUrl) {
      const filename = path.basename(message.fileUrl as string);
      const filePath = path.join(process.cwd(), 'uploads', filename);
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }

    await this.prisma.message.delete({ where: { id: messageId } });
    return { success: true };
  }

  async getDeleteNotifications(userId: string) {
    const prismaAny = this.prisma as any;
    return prismaAny.deleteNotification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markNotificationsRead(userId: string) {
    const prismaAny = this.prisma as any;
    await prismaAny.deleteNotification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  async getWorkspaceRoles(workspaceId: string) {
    const prismaAny = this.prisma as any;
    return prismaAny.workspaceRole.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createWorkspaceRole(
    workspaceId: string,
    name: string,
    color: string,
    requesterId: string,
  ) {
    const requester = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: requesterId },
    });
    if (!requester || !['OWNER', 'ADMIN'].includes(requester.role)) {
      throw new ForbiddenException('Brak uprawnień do zarządzania rolami');
    }
    const prismaAny = this.prisma as any;
    return prismaAny.workspaceRole.create({
      data: { workspaceId, name, color },
    });
  }

  async updateWorkspaceRole(
    workspaceId: string,
    roleId: string,
    name: string,
    color: string,
    requesterId: string,
  ) {
    const requester = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: requesterId },
    });
    if (!requester || !['OWNER', 'ADMIN'].includes(requester.role)) {
      throw new ForbiddenException('Brak uprawnień do zarządzania rolami');
    }
    const prismaAny = this.prisma as any;
    return prismaAny.workspaceRole.update({
      where: { id: roleId },
      data: { name, color },
    });
  }

  async deleteWorkspaceRole(
    workspaceId: string,
    roleId: string,
    requesterId: string,
  ) {
    const requester = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: requesterId },
    });
    if (!requester || !['OWNER', 'ADMIN'].includes(requester.role)) {
      throw new ForbiddenException('Brak uprawnień do zarządzania rolami');
    }
    const prismaAny = this.prisma as any;
    return prismaAny.workspaceRole.delete({ where: { id: roleId } });
  }

  async assignCustomRole(
    workspaceId: string,
    targetUserId: string,
    customRoleId: string | null,
    requesterId: string,
  ) {
    const requester = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: requesterId },
    });
    if (!requester || !['OWNER', 'ADMIN'].includes(requester.role)) {
      throw new ForbiddenException('Brak uprawnień');
    }
    const target = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUserId },
    });
    if (!target) throw new NotFoundException('Użytkownik nie jest członkiem');

    const prismaAny = this.prisma as any;
    return prismaAny.workspaceMember.update({
      where: { id: target.id },
      data: { customRoleId: customRoleId ?? null },
      include: { user: true, customRole: true },
    });
  }
}
