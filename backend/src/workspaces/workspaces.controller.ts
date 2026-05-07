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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  assignCustomRole(
    @Param('id') workspaceId: string,
    @Param('userId') userId: string,
    @Body('customRoleId') customRoleId: string,
    @Req() req: any,
  ) {
    return this.workspacesService.assignCustomRole(
      workspaceId,
      userId,
      customRoleId || null,
      req.user.uid,
    );
  }

  @Get(':id/tasks')
  getTasks(@Param('id') workspaceId: string) {
    return this.workspacesService.getTasks(workspaceId);
  }

  @Post(':id/tasks')
  createTask(
    @Param('id') workspaceId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.workspacesService.createTask(
      workspaceId,
      body.title,
      body.description,
      body.priority,
      body.assigneeIds || [],
      body.dueDate,
      req.user.uid,
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
