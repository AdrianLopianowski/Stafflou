import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';

@Controller('workspaces')
@UseGuards(FirebaseAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  create(@Req() req: any, @Body() createWorkspaceDto: CreateWorkspaceDto) {
    createWorkspaceDto.userId = req.user.uid;
    return this.workspacesService.create(createWorkspaceDto);
  }

  @Get('notifications/deleted')
  getDeleteNotifications(@Req() req: any) {
    return this.workspacesService.getDeleteNotifications(req.user.uid);
  }

  @Patch('notifications/deleted/read')
  markNotificationsRead(@Req() req: any) {
    return this.workspacesService.markNotificationsRead(req.user.uid);
  }

  @Get('notifications/tasks')
  getTaskNotifications(@Req() req: any) {
    return this.workspacesService.getTaskNotifications(req.user.uid);
  }

  @Patch('notifications/tasks/read')
  markTaskNotificationsRead(@Req() req: any) {
    return this.workspacesService.markTaskNotificationsRead(req.user.uid);
  }

  @Get('test-create/:userId')
  testCreate(@Param('userId') userId: string) {
    return this.workspacesService.create({
      name: 'Moja Super Firma',
      userId: userId,
    });
  }

  @Get()
  findAll(@Req() req: any) {
    const userId = req.user.uid;
    return this.workspacesService.findAllForUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workspacesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(id, updateWorkspaceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.workspacesService.remove(id);
  }

  @Get(':id/members')
  getMembers(@Param('id') id: string) {
    return this.workspacesService.getMembers(id);
  }

  @Patch(':id/members/:userId/role')
  updateMemberRole(
    @Param('id') workspaceId: string,
    @Param('userId') userId: string,
    @Body('role') role: 'OWNER' | 'ADMIN' | 'MEMBER',
    @Req() req: any,
  ) {
    return this.workspacesService.updateMemberRole(
      workspaceId,
      userId,
      role,
      req.user.uid,
    );
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') workspaceId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.workspacesService.removeMember(
      workspaceId,
      userId,
      req.user.uid,
    );
  }

  @Get(':id/channels')
  findAllChannels(@Param('id') id: string) {
    return this.workspacesService.getChannels(id);
  }

  @Post(':id/channels')
  createChannel(
    @Param('id') id: string,
    @Body() body: { name: string; type: 'TEXT' | 'INFO' },
    @Req() req: any,
  ) {
    return this.workspacesService.createChannel(
      id,
      body.name,
      body.type,
      req.user.uid,
    );
  }

  @Get(':id/channels/:channelId/pinned')
  getPinnedMessages(@Param('channelId') channelId: string) {
    return this.workspacesService.getPinnedMessages(channelId);
  }

  @Patch(':id/channels/:channelId/messages/:messageId/pin')
  togglePinMessage(
    @Param('id') workspaceId: string,
    @Param('messageId') messageId: string,
    @Req() req: any,
  ) {
    return this.workspacesService.togglePinMessage(workspaceId, messageId, req.user.uid);
  }

  @Get(':id/channels/:channelId/polls')
  getPolls(@Param('channelId') channelId: string) {
    return this.workspacesService.getPolls(channelId);
  }

  @Post(':id/channels/:channelId/polls')
  createPoll(
    @Param('id') workspaceId: string,
    @Param('channelId') channelId: string,
    @Body() body: { question: string; options: string[]; isMultiple: boolean },
    @Req() req: any,
  ) {
    return this.workspacesService.createPoll(
      workspaceId,
      channelId,
      req.user.uid,
      body.question,
      body.options,
      body.isMultiple,
    );
  }

  @Post(':id/channels/:channelId/polls/:pollId/vote')
  voteOnPoll(
    @Param('id') workspaceId: string,
    @Param('pollId') pollId: string,
    @Body('optionId') optionId: string,
    @Req() req: any,
  ) {
    return this.workspacesService.voteOnPoll(workspaceId, pollId, optionId, req.user.uid);
  }

  @Patch(':id/channels/:channelId/polls/:pollId/close')
  closePoll(
    @Param('id') workspaceId: string,
    @Param('pollId') pollId: string,
    @Req() req: any,
  ) {
    return this.workspacesService.closePoll(workspaceId, pollId, req.user.uid);
  }

  @Get(':id/channels/:channelId/messages')
  getMessages(@Param('channelId') channelId: string) {
    return this.workspacesService.getMessages(channelId);
  }

  @Post(':id/channels/:channelId/messages')
  sendMessage(
    @Param('id') workspaceId: string,
    @Param('channelId') channelId: string,
    @Body('content') content: string,
    @Req() req: any,
  ) {
    return this.workspacesService.sendMessage(
      workspaceId,
      channelId,
      req.user.uid,
      content,
    );
  }

  @Post(':id/channels/:channelId/messages/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req: any, file: any, cb: any) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  uploadFile(
    @Param('id') workspaceId: string,
    @Param('channelId') channelId: string,
    @UploadedFile() file: any,
    @Body('content') content: string,
    @Req() req: any,
  ) {
    const fileUrl = `/uploads/${file.filename}`;
    const mime = file.mimetype;
    const fileType = mime.startsWith('image/')
      ? 'image'
      : mime.startsWith('video/')
        ? 'video'
        : 'document';

    return this.workspacesService.sendFileMessage(
      workspaceId,
      channelId,
      req.user.uid,
      fileUrl,
      file.originalname,
      fileType,
      content || undefined,
    );
  }

  @Delete(':id/channels/:channelId/messages/:messageId')
  deleteMessage(
    @Param('id') workspaceId: string,
    @Param('messageId') messageId: string,
    @Req() req: any,
  ) {
    return this.workspacesService.deleteMessage(
      workspaceId,
      messageId,
      req.user.uid,
    );
  }

  @Patch(':id/channels/:channelId/messages/:messageId')
  editMessage(
    @Param('id') workspaceId: string,
    @Param('messageId') messageId: string,
    @Body('content') content: string,
    @Req() req: any,
  ) {
    return this.workspacesService.editMessage(
      workspaceId,
      messageId,
      content,
      req.user.uid,
    );
  }

  @Post(':id/channels/:channelId/messages/:messageId/reactions')
  toggleReaction(
    @Param('id') workspaceId: string,
    @Param('messageId') messageId: string,
    @Body('emoji') emoji: string,
    @Req() req: any,
  ) {
    return this.workspacesService.toggleReaction(
      workspaceId,
      messageId,
      emoji,
      req.user.uid,
    );
  }

  @Get(':id/roles')
  getWorkspaceRoles(@Param('id') id: string) {
    return this.workspacesService.getWorkspaceRoles(id);
  }

  @Post(':id/roles')
  createWorkspaceRole(
    @Param('id') id: string,
    @Body() body: { name: string; color: string },
    @Req() req: any,
  ) {
    return this.workspacesService.createWorkspaceRole(
      id,
      body.name,
      body.color,
      req.user.uid,
    );
  }

  @Patch(':id/roles/:roleId')
  updateWorkspaceRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @Body() body: { name: string; color: string },
    @Req() req: any,
  ) {
    return this.workspacesService.updateWorkspaceRole(
      id,
      roleId,
      body.name,
      body.color,
      req.user.uid,
    );
  }

  @Delete(':id/roles/:roleId')
  deleteWorkspaceRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @Req() req: any,
  ) {
    return this.workspacesService.deleteWorkspaceRole(id, roleId, req.user.uid);
  }

  @Patch(':id/members/:userId/custom-role')
  toggleCustomRole(
    @Param('id') workspaceId: string,
    @Param('userId') userId: string,
    @Body('customRoleId') customRoleId: string,
    @Req() req: any,
  ) {
    return this.workspacesService.toggleCustomRole(
      workspaceId,
      userId,
      customRoleId,
      req.user.uid,
    );
  }

  @Get(':id/tasks')
  getTasks(@Param('id') workspaceId: string) {
    return this.workspacesService.getTasks(workspaceId);
  }

  @Post(':id/tasks')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req: any, file: any, cb: any) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  createTask(
    @Param('id') workspaceId: string,
    @Body() body: any,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    const assigneeIds = body.assigneeIds
      ? typeof body.assigneeIds === 'string'
        ? JSON.parse(body.assigneeIds)
        : body.assigneeIds
      : [];
    const attachmentUrl = file ? `/uploads/${file.filename}` : undefined;
    const attachmentName = file ? file.originalname : undefined;
    const attachmentType = file
      ? file.mimetype.startsWith('image/')
        ? 'image'
        : file.mimetype.startsWith('video/')
          ? 'video'
          : 'document'
      : undefined;

    return this.workspacesService.createTask(
      workspaceId,
      body.title,
      body.description,
      body.priority,
      assigneeIds,
      body.dueDate,
      req.user.uid,
      body.submissionType || 'NONE',
      body.submissionMode || 'INDIVIDUAL',
      attachmentUrl,
      attachmentName,
      attachmentType,
    );
  }

  @Post(':id/tasks/:taskId/submit')
  @UseInterceptors(
    FilesInterceptor('files', 4, {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req: any, file: any, cb: any) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  submitTask(
    @Param('id') workspaceId: string,
    @Param('taskId') taskId: string,
    @Body('textContent') textContent: string,
    @UploadedFiles() files: any[],
    @Req() req: any,
  ) {
    const fileUrls = files?.map((f) => `/uploads/${f.filename}`) || [];
    const fileNames = files?.map((f) => f.originalname) || [];
    const fileTypes =
      files?.map((f) =>
        f.mimetype.startsWith('image/')
          ? 'image'
          : f.mimetype.startsWith('video/')
            ? 'video'
            : 'document',
      ) || [];
    return this.workspacesService.submitTask(
      workspaceId,
      taskId,
      req.user.uid,
      textContent,
      fileUrls,
      fileNames,
      fileTypes,
    );
  }

  @Patch(':id/tasks/:taskId')
  updateTask(
    @Param('id') workspaceId: string,
    @Param('taskId') taskId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.workspacesService.updateTask(
      workspaceId,
      taskId,
      body,
      req.user.uid,
    );
  }

  @Delete(':id/tasks/:taskId')
  deleteTask(
    @Param('id') workspaceId: string,
    @Param('taskId') taskId: string,
    @Req() req: any,
  ) {
    return this.workspacesService.deleteTask(workspaceId, taskId, req.user.uid);
  }
}
