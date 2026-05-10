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

  async togglePinMessage(
    workspaceId: string,
    messageId: string,
    userId: string,
  ) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!member) throw new ForbiddenException('Brak uprawnień');
    const prismaAny = this.prisma as any;
    const msg = await prismaAny.message.findUnique({ where: { id: messageId } });
    return prismaAny.message.update({
      where: { id: messageId },
      data: { isPinned: !msg.isPinned },
    });
  }

  async getPinnedMessages(channelId: string) {
    const prismaAny = this.prisma as any;
    const messages = await prismaAny.message.findMany({
      where: { channelId, isPinned: true },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
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

  async createPoll(
    workspaceId: string,
    channelId: string,
    userId: string,
    question: string,
    options: string[],
    isMultiple: boolean,
  ) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!member) throw new ForbiddenException('Brak dostępu');
    const prismaAny = this.prisma as any;
    return prismaAny.poll.create({
      data: {
        channelId,
        workspaceId,
        createdById: userId,
        question,
        isMultiple,
        options: { create: options.map((text) => ({ text })) },
      },
      include: { options: true },
    });
  }

  async getPolls(channelId: string) {
    const prismaAny = this.prisma as any;
    return prismaAny.poll.findMany({
      where: { channelId },
      orderBy: { createdAt: 'asc' },
      include: { options: true },
    });
  }

  async voteOnPoll(
    workspaceId: string,
    pollId: string,
    optionId: string,
    userId: string,
  ) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!member) throw new ForbiddenException('Brak dostępu');
    const prismaAny = this.prisma as any;
    const poll = await prismaAny.poll.findUnique({
      where: { id: pollId },
      include: { options: true },
    });
    if (!poll || poll.isClosed) throw new ForbiddenException('Ankieta zamknięta');

    if (!poll.isMultiple) {
      for (const opt of poll.options) {
        if (opt.id !== optionId && (opt.voterIds as string[]).includes(userId)) {
          await prismaAny.pollOption.update({
            where: { id: opt.id },
            data: { voterIds: opt.voterIds.filter((id: string) => id !== userId) },
          });
        }
      }
    }

    const target = poll.options.find((o: any) => o.id === optionId);
    const hasVoted = (target.voterIds as string[]).includes(userId);
    return prismaAny.pollOption.update({
      where: { id: optionId },
      data: {
        voterIds: hasVoted
          ? target.voterIds.filter((id: string) => id !== userId)
          : [...target.voterIds, userId],
      },
    });
  }

  async closePoll(workspaceId: string, pollId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!member) throw new ForbiddenException('Brak uprawnień');
    const prismaAny = this.prisma as any;
    return prismaAny.poll.update({
      where: { id: pollId },
      data: { isClosed: true },
    });
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
      include: { user: true },
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

  async toggleCustomRole(
    workspaceId: string,
    targetUserId: string,
    customRoleId: string,
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
    const currentIds: string[] = (target as any).customRoleIds || [];
    const newIds = currentIds.includes(customRoleId)
      ? currentIds.filter((id) => id !== customRoleId)
      : [...currentIds, customRoleId];

    return prismaAny.workspaceMember.update({
      where: { id: target.id },
      data: { customRoleIds: newIds },
      include: { user: true },
    });
  }

  async getTasks(workspaceId: string) {
    const prismaAny = this.prisma as any;
    return prismaAny.task.findMany({
      where: { workspaceId },
      include: { createdBy: true, submissions: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createTask(
    workspaceId: string,
    title: string,
    description: string | undefined,
    priority: string,
    assigneeIds: string[],
    dueDate: string | undefined,
    createdById: string,
    submissionType: string,
    submissionMode: string,
    attachmentUrl?: string,
    attachmentName?: string,
    attachmentType?: string,
  ) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: createdById },
    });
    if (!member) throw new ForbiddenException('Brak dostępu');

    const prismaAny = this.prisma as any;
    const task = await prismaAny.task.create({
      data: {
        title,
        description: description || undefined,
        priority: priority || 'MEDIUM',
        workspaceId,
        assigneeIds: assigneeIds || [],
        dueDate: dueDate ? new Date(dueDate) : undefined,
        createdById,
        submissionType: submissionType || 'NONE',
        submissionMode: submissionMode || 'INDIVIDUAL',
        attachmentUrl: attachmentUrl || undefined,
        attachmentName: attachmentName || undefined,
        attachmentType: attachmentType || undefined,
      },
      include: { createdBy: true, submissions: true },
    });

    for (const assigneeId of assigneeIds || []) {
      if (assigneeId !== createdById) {
        await prismaAny.taskNotification.create({
          data: {
            userId: assigneeId,
            workspaceId,
            taskId: task.id,
            taskTitle: title,
          },
        });
      }
    }

    return task;
  }

  async submitTask(
    workspaceId: string,
    taskId: string,
    submittedById: string,
    textContent?: string,
    fileUrls?: string[],
    fileNames?: string[],
    fileTypes?: string[],
  ) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: submittedById },
    });
    if (!member) throw new ForbiddenException('Brak dostępu');

    const prismaAny = this.prisma as any;

    const task = await prismaAny.task.findUnique({ where: { id: taskId } });

    const submission = await prismaAny.taskSubmission.create({
      data: {
        taskId,
        submittedById,
        textContent: textContent || undefined,
        fileUrls: fileUrls || [],
        fileNames: fileNames || [],
        fileTypes: fileTypes || [],
      },
    });

    if ((task as any)?.submissionMode === 'GROUP') {
      await prismaAny.task.update({
        where: { id: taskId },
        data: { status: 'DONE' },
      });
    } else {
      const currentCompleted: string[] = (task as any)?.completedByIds || [];
      if (!currentCompleted.includes(submittedById)) {
        const updatedCompleted = [...currentCompleted, submittedById];
        const assigneeIds: string[] = (task as any)?.assigneeIds || [];
        const allDone =
          assigneeIds.length > 0 &&
          assigneeIds.every((id: string) => updatedCompleted.includes(id));
        await prismaAny.task.update({
          where: { id: taskId },
          data: {
            completedByIds: updatedCompleted,
            ...(allDone ? { status: 'DONE' } : {}),
          },
        });
      }
    }

    return submission;
  }

  async updateTask(
    workspaceId: string,
    taskId: string,
    updates: {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      assigneeIds?: string[] | null;
      dueDate?: string | null;
    },
    requesterId: string,
  ) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: requesterId },
    });
    if (!member) throw new ForbiddenException('Brak dostępu');

    const prismaAny = this.prisma as any;

    let currentTask: any = null;
    if (updates.assigneeIds !== undefined || updates.status !== undefined) {
      currentTask = await prismaAny.task.findUnique({ where: { id: taskId } });
    }

    if (updates.assigneeIds !== undefined && updates.assigneeIds !== null && currentTask) {
      const oldIds: string[] = currentTask.assigneeIds || [];
      const newIds: string[] = updates.assigneeIds ?? [];
      const taskTitle: string = updates.title ?? currentTask.title;
      for (const newId of newIds) {
        if (!oldIds.includes(newId) && newId !== requesterId) {
          await prismaAny.taskNotification.create({
            data: { userId: newId, workspaceId, taskId, taskTitle },
          });
        }
      }
    }

    const baseData = {
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.priority !== undefined && { priority: updates.priority }),
      ...(updates.assigneeIds !== undefined && { assigneeIds: updates.assigneeIds ?? [] }),
      ...(updates.dueDate !== undefined && {
        dueDate: updates.dueDate ? new Date(updates.dueDate) : null,
      }),
    };

    if (
      updates.status &&
      currentTask?.submissionMode === 'INDIVIDUAL' &&
      (currentTask?.assigneeIds as string[])?.includes(requesterId)
    ) {
      const inProgressByIds: string[] = currentTask.inProgressByIds || [];
      const completedByIds: string[] = currentTask.completedByIds || [];
      const assigneeIds: string[] = currentTask.assigneeIds || [];

      let newInProgress = [...inProgressByIds];
      let newCompleted = [...completedByIds];
      let globalStatus: string | undefined;

      if (updates.status === 'IN_PROGRESS') {
        if (!newInProgress.includes(requesterId)) newInProgress.push(requesterId);
        newCompleted = newCompleted.filter((id) => id !== requesterId);
      } else if (updates.status === 'DONE') {
        if (!newCompleted.includes(requesterId)) newCompleted.push(requesterId);
        newInProgress = newInProgress.filter((id) => id !== requesterId);
        if (assigneeIds.length > 0 && assigneeIds.every((id) => newCompleted.includes(id))) {
          globalStatus = 'DONE';
        }
      } else if (updates.status === 'TODO') {
        newInProgress = newInProgress.filter((id) => id !== requesterId);
        newCompleted = newCompleted.filter((id) => id !== requesterId);
      }

      return prismaAny.task.update({
        where: { id: taskId },
        data: {
          ...baseData,
          inProgressByIds: newInProgress,
          completedByIds: newCompleted,
          ...(globalStatus !== undefined && { status: globalStatus }),
        },
        include: { createdBy: true },
      });
    }

    return prismaAny.task.update({
      where: { id: taskId },
      data: {
        ...baseData,
        ...(updates.status !== undefined && { status: updates.status }),
      },
      include: { createdBy: true },
    });
  }

  async deleteTask(workspaceId: string, taskId: string, requesterId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: requesterId },
    });
    if (!member) throw new ForbiddenException('Brak dostępu');

    const prismaAny = this.prisma as any;
    await prismaAny.task.delete({ where: { id: taskId } });
    return { success: true };
  }

  async getTaskNotifications(userId: string) {
    const prismaAny = this.prisma as any;
    return prismaAny.taskNotification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markTaskNotificationsRead(userId: string) {
    const prismaAny = this.prisma as any;
    await prismaAny.taskNotification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  async getDMConversations(workspaceId: string, userId: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, NOT: { userId } },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const prismaAny = this.prisma as any;
    return Promise.all(
      members.map(async (m) => {
        const lastMessage = await prismaAny.directMessage.findFirst({
          where: {
            workspaceId,
            OR: [
              { senderId: userId, recipientId: m.userId },
              { senderId: m.userId, recipientId: userId },
            ],
          },
          orderBy: { createdAt: 'desc' },
        });
        const unreadCount = await prismaAny.directMessage.count({
          where: {
            workspaceId,
            senderId: m.userId,
            recipientId: userId,
            isRead: false,
          },
        });
        return { member: m, lastMessage, unreadCount };
      }),
    );
  }

  async getDMHistory(workspaceId: string, userId: string, otherUserId: string) {
    const prismaAny = this.prisma as any;
    await prismaAny.directMessage.updateMany({
      where: { workspaceId, senderId: otherUserId, recipientId: userId, isRead: false },
      data: { isRead: true },
    });
    return prismaAny.directMessage.findMany({
      where: {
        workspaceId,
        OR: [
          { senderId: userId, recipientId: otherUserId },
          { senderId: otherUserId, recipientId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendDM(
    workspaceId: string,
    senderId: string,
    recipientId: string,
    content: string,
  ) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: senderId, workspaceId } },
    });
    if (!member) throw new ForbiddenException('Nie jesteś członkiem tej przestrzeni.');
    const prismaAny = this.prisma as any;
    return prismaAny.directMessage.create({
      data: { workspaceId, senderId, recipientId, content },
    });
  }

  async sendDMFile(
    workspaceId: string,
    senderId: string,
    recipientId: string,
    fileUrl: string,
    fileName: string,
    fileType: string,
    content?: string,
  ) {
    const prismaAny = this.prisma as any;
    return prismaAny.directMessage.create({
      data: { workspaceId, senderId, recipientId, fileUrl, fileName, fileType, content },
    });
  }

  async editDM(
    workspaceId: string,
    messageId: string,
    userId: string,
    content: string,
  ) {
    const prismaAny = this.prisma as any;
    const msg = await prismaAny.directMessage.findUnique({ where: { id: messageId } });
    if (!msg || msg.workspaceId !== workspaceId)
      throw new NotFoundException('Wiadomość nie istnieje.');
    if (msg.senderId !== userId)
      throw new ForbiddenException('Nie możesz edytować tej wiadomości.');
    return prismaAny.directMessage.update({
      where: { id: messageId },
      data: { content, isEdited: true },
    });
  }

  async deleteDM(workspaceId: string, messageId: string, userId: string) {
    const prismaAny = this.prisma as any;
    const msg = await prismaAny.directMessage.findUnique({ where: { id: messageId } });
    if (!msg || msg.workspaceId !== workspaceId)
      throw new NotFoundException('Wiadomość nie istnieje.');
    if (msg.senderId !== userId)
      throw new ForbiddenException('Nie możesz usunąć tej wiadomości.');
    if (msg.fileUrl) {
      const filePath = path.join('./uploads', path.basename(msg.fileUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    return prismaAny.directMessage.delete({ where: { id: messageId } });
  }

  async markDMsRead(workspaceId: string, userId: string, otherUserId: string) {
    const prismaAny = this.prisma as any;
    await prismaAny.directMessage.updateMany({
      where: {
        workspaceId,
        senderId: otherUserId,
        recipientId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });
    return { success: true };
  }
}
