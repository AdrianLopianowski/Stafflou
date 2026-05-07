import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth, signOut, onAuthStateChanged } from '@angular/fire/auth';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { WorkspaceService } from '../../services/workspace.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  public auth = inject(Auth);
  private router = inject(Router);
  private workspaceService = inject(WorkspaceService);
  public themeService = inject(ThemeService);
  private sanitizer = inject(DomSanitizer);
  workspaces: any[] = [];
  activeWorkspace: any = null;
  activeChannel: any = null;
  isLoadingWorkspaces = true;

  isCreateModalOpen = false;
  newWorkspaceName = '';
  isCreating = false;

  channels: any[] = [];
  isChannelModalOpen = false;
  newChannelName = '';
  newChannelType: 'TEXT' | 'INFO' = 'TEXT';

  messages: any[] = [];
  newMessageContent = '';

  invitations: any[] = [];
  isNotificationOpen = false;
  isInviteModalOpen = false;
  inviteEmail = '';
  isInviting = false;

  myProfile: any = null;
  showOnboarding = false;
  onboardingData = {
    firstName: '',
    lastName: '',
    location: '',
  };

  isProfileDropdownOpen = false;
  isSettingsModalOpen = false;
  settingsData = { firstName: '', lastName: '', location: '' };
  isSavingSettings = false;

  members: any[] = [];
  selectedMember: any = null;
  isMemberModalOpen = false;
  isUpdatingRole = false;
  isRemovingMember = false;

  deleteNotifications: any[] = [];
  selectedFile: File | null = null;
  isUploadingFile = false;

  workspaceRoles: any[] = [];
  isRolesModalOpen = false;
  newRoleName = '';
  newRoleColor = '#6366f1';
  isCreatingRole = false;

  mentionDropdownOpen = false;
  mentionSearch = '';
  mentionCandidates: any[] = [];
  mentionStartIndex = -1;

  editingMessageId: string | null = null;
  editingContent = '';
  isSavingEdit = false;

  emojiPickerMsg: any = null;
  emojiPickerPos = { top: 0, right: 0 };
  readonly quickEmojis = ['👍', '❤️', '😂', '🎉', '😮', '😢', '🔥', '✅'];

  userPopoverMember: any = null;
  userPopoverPos = { top: 0, left: 0 };

  activeView: 'overview' | 'channel' | 'tasks' = 'overview';
  isWorkspaceSelectorOpen = false;

  tasks: any[] = [];
  isCreateTaskModalOpen = false;
  isTeamModalOpen = false;
  newTask = {
    title: '',
    description: '',
    priority: 'MEDIUM',
    assigneeIds: [] as string[],
    dueDate: '',
  };
  isCreatingTask = false;

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        await this.loadMyProfile();

        if (!this.myProfile?.firstName) {
          this.showOnboarding = true;
          return;
        }

        await this.loadWorkspaces();
        await Promise.all([
          this.loadInvitations(),
          this.loadDeleteNotifications(),
        ]);
      }
    });
  }

  async loadWorkspaces() {
    this.isLoadingWorkspaces = true;
    try {
      const data: any = await this.workspaceService.getMyWorkspaces();
      this.workspaces = data;

      if (this.workspaces.length > 0 && !this.activeWorkspace) {
        this.activeWorkspace = this.workspaces[0];
        await Promise.all([
          this.loadChannels(this.activeWorkspace.id),
          this.loadMembers(this.activeWorkspace.id),
          this.loadWorkspaceRoles(this.activeWorkspace.id),
        ]);
      }
    } catch (error) {
      console.error('Błąd pobierania przestrzeni:', error);
    } finally {
      this.isLoadingWorkspaces = false;
    }
  }
  async loadMessages() {
    if (!this.activeWorkspace || !this.activeChannel) return;
    try {
      this.messages = (await this.workspaceService.getMessages(
        this.activeWorkspace.id,
        this.activeChannel.id,
      )) as any[];
    } catch (e) {
      console.error('Błąd pobierania wiadomości', e);
    }
  }
  async sendMessage() {
    if (
      !this.newMessageContent.trim() ||
      !this.activeWorkspace ||
      !this.activeChannel
    )
      return;
    try {
      await this.workspaceService.sendMessage(
        this.activeWorkspace.id,
        this.activeChannel.id,
        this.newMessageContent,
      );
      this.newMessageContent = '';
      await this.loadMessages();
    } catch (e) {
      console.error('Błąd wysyłania', e);
      alert('Nie udało się wysłać wiadomości. Brak uprawnień?');
    }
  }
  async selectChannel(channel: any, event: Event) {
    event.preventDefault();
    this.activeChannel = channel;
    this.activeView = 'channel';
    await this.loadMessages();
  }
  openCreateModal() {
    this.newWorkspaceName = '';
    this.isCreateModalOpen = true;
  }

  closeCreateModal() {
    this.isCreateModalOpen = false;
    this.newWorkspaceName = '';
  }

  async submitNewWorkspace() {
    if (!this.newWorkspaceName || this.newWorkspaceName.trim().length === 0)
      return;

    this.isCreating = true;
    try {
      await this.workspaceService.createWorkspace(this.newWorkspaceName.trim());
      await this.loadWorkspaces();
      this.closeCreateModal();
    } catch (error) {
      console.error('Błąd podczas tworzenia przestrzeni:', error);
      alert('Wystąpił błąd podczas tworzenia. Sprawdź konsolę.');
    } finally {
      this.isCreating = false;
    }
  }
  get currentUserRole(): string {
    if (!this.activeWorkspace || !this.auth.currentUser) return 'MEMBER';
    const member = this.activeWorkspace.members.find(
      (m: any) => m.userId === this.auth.currentUser?.uid,
    );
    return member ? member.role : 'MEMBER';
  }
  async selectWorkspace(workspace: any) {
    this.activeWorkspace = workspace;
    this.activeChannel = null;
    this.activeView = 'overview';
    this.isWorkspaceSelectorOpen = false;
    this.tasks = [];
    await Promise.all([
      this.loadChannels(workspace.id),
      this.loadMembers(workspace.id),
      this.loadWorkspaceRoles(workspace.id),
    ]);
  }

  async loadMembers(workspaceId: string) {
    try {
      this.members = (await this.workspaceService.getMembers(
        workspaceId,
      )) as any[];
    } catch (e) {
      console.error('Błąd pobierania członków', e);
    }
  }

  openMemberModal(member: any) {
    this.selectedMember = member;
    this.isMemberModalOpen = true;
  }

  canManageMember(member: any): boolean {
    const myRole = this.currentUserRole;
    if (myRole === 'OWNER') return member.userId !== this.auth.currentUser?.uid;
    if (myRole === 'ADMIN') return member.role === 'MEMBER';
    return false;
  }

  canRemoveMember(member: any): boolean {
    const myRole = this.currentUserRole;
    if (myRole === 'OWNER') return member.userId !== this.auth.currentUser?.uid;
    if (myRole === 'ADMIN') return member.role === 'MEMBER';
    return false;
  }

  availableRoles(): string[] {
    if (this.currentUserRole === 'OWNER') return ['MEMBER', 'ADMIN', 'OWNER'];
    if (this.currentUserRole === 'ADMIN') return ['MEMBER', 'ADMIN'];
    return [];
  }

  async updateRole(newRole: 'OWNER' | 'ADMIN' | 'MEMBER') {
    if (!this.activeWorkspace || !this.selectedMember) return;
    this.isUpdatingRole = true;
    try {
      await this.workspaceService.updateMemberRole(
        this.activeWorkspace.id,
        this.selectedMember.userId,
        newRole,
      );
      await this.loadMembers(this.activeWorkspace.id);
      await this.loadWorkspaces();
      this.isMemberModalOpen = false;
    } catch (e: any) {
      alert(e?.error?.message || 'Nie udało się zmienić roli.');
    } finally {
      this.isUpdatingRole = false;
    }
  }

  async removeMember() {
    if (!this.activeWorkspace || !this.selectedMember) return;
    const name =
      this.selectedMember.user?.displayName || this.selectedMember.user?.email;
    if (!confirm(`Czy na pewno chcesz usunąć ${name} z zespołu?`)) return;
    this.isRemovingMember = true;
    try {
      await this.workspaceService.removeMember(
        this.activeWorkspace.id,
        this.selectedMember.userId,
      );
      await this.loadMembers(this.activeWorkspace.id);
      await this.loadWorkspaces();
      this.isMemberModalOpen = false;
    } catch (e: any) {
      alert(e?.error?.message || 'Nie udało się usunąć członka.');
    } finally {
      this.isRemovingMember = false;
    }
  }

  roleLabel(role: string): string {
    return (
      { OWNER: 'Właściciel', ADMIN: 'Admin', MEMBER: 'Członek' }[role] ?? role
    );
  }

  roleBadgeClass(role: string): string {
    return (
      {
        OWNER:
          'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
        ADMIN:
          'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
        MEMBER: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      }[role] ?? ''
    );
  }

  memberGroups(): { role: string; members: any[] }[] {
    return ['OWNER', 'ADMIN', 'MEMBER'].map((role) => ({
      role,
      members: this.members.filter((m) => m.role === role),
    }));
  }

  getMemberInitials(member: any): string {
    const first = member.user?.firstName?.[0] || '';
    const last = member.user?.lastName?.[0] || '';
    return (
      (first + last).toUpperCase() ||
      member.user?.email?.[0]?.toUpperCase() ||
      '?'
    );
  }

  async loadChannels(workspaceId: string) {
    try {
      const data: any = await this.workspaceService.getChannels(workspaceId);
      this.channels = data;
    } catch (e: any) {
      console.error('Błąd pobierania kanałów', e);
    }
  }
  async submitNewChannel() {
    if (!this.newChannelName || !this.activeWorkspace) return;
    try {
      await this.workspaceService.createChannel(
        this.activeWorkspace.id,
        this.newChannelName,
        this.newChannelType,
      );
      await this.loadChannels(this.activeWorkspace.id);
      this.isChannelModalOpen = false;
      this.newChannelName = '';
    } catch (e: any) {
      alert('Tylko właściciel może tworzyć kanały!');
    }
  }

  async loadInvitations() {
    try {
      const data: any = await this.workspaceService.getMyInvitations();
      this.invitations = data || [];
      console.log('Pobrane zaproszenia z serwera:', this.invitations);
    } catch (error) {
      console.error('Błąd pobierania zaproszeń:', error);
    }
  }
  openInviteModal() {
    this.inviteEmail = '';
    this.isInviteModalOpen = true;
  }

  closeInviteModal() {
    this.isInviteModalOpen = false;
    this.inviteEmail = '';
  }

  async submitInvite() {
    if (!this.inviteEmail.trim() || !this.activeWorkspace) return;

    this.isInviting = true;
    try {
      await this.workspaceService.inviteUser(
        this.activeWorkspace.id,
        this.inviteEmail.trim(),
      );
      alert(`Wysłano zaproszenie do: ${this.inviteEmail}`);
      this.closeInviteModal();
    } catch (e) {
      console.error('Błąd wysyłania zaproszenia:', e);
      alert('Nie udało się wysłać zaproszenia. Sprawdź konsolę.');
    } finally {
      this.isInviting = false;
    }
  }

  async acceptInv(id: string) {
    await this.workspaceService.acceptInvitation(id);
    await this.loadWorkspaces();
    await this.loadInvitations();
    this.isNotificationOpen = false;
  }
  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }

  getInitials(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
  }
  async loadMyProfile() {
    try {
      this.myProfile = await this.workspaceService.getMyProfile();
    } catch (error) {
      console.error('Błąd pobierania profilu:', error);
    }
  }

  openSettings() {
    this.settingsData = {
      firstName: this.myProfile?.firstName || '',
      lastName: this.myProfile?.lastName || '',
      location: this.myProfile?.location || '',
    };
    this.isProfileDropdownOpen = false;
    this.isSettingsModalOpen = true;
  }

  async submitSettings() {
    if (!this.settingsData.firstName || !this.settingsData.lastName) return;
    this.isSavingSettings = true;
    try {
      await this.workspaceService.updateMyProfile(this.settingsData);
      this.myProfile = { ...this.myProfile, ...this.settingsData };
      this.isSettingsModalOpen = false;
    } catch (error) {
      console.error('Błąd zapisu ustawień:', error);
      alert('Nie udało się zapisać danych.');
    } finally {
      this.isSavingSettings = false;
    }
  }

  getProfileInitials(): string {
    const first = this.myProfile?.firstName?.[0] || '';
    const last = this.myProfile?.lastName?.[0] || '';
    return (first + last).toUpperCase() || '?';
  }

  async submitOnboarding() {
    if (!this.onboardingData.firstName || !this.onboardingData.lastName) {
      alert('Imię i nazwisko są wymagane!');
      return;
    }

    try {
      await this.workspaceService.updateMyProfile(this.onboardingData);
      this.showOnboarding = false;
      await this.loadWorkspaces();
      await Promise.all([
        this.loadInvitations(),
        this.loadDeleteNotifications(),
      ]);
    } catch (error) {
      console.error('Błąd zapisu profilu:', error);
      alert('Nie udało się zapisać danych.');
    }
  }

  async loadDeleteNotifications() {
    try {
      const data: any = await this.workspaceService.getDeleteNotifications();
      this.deleteNotifications = data || [];
    } catch (e) {
      console.error('Błąd pobierania powiadomień o usunięciu:', e);
    }
  }

  async deleteMessage(msg: any) {
    if (!this.activeWorkspace || !this.activeChannel) return;
    if (!confirm('Czy na pewno chcesz usunąć tę wiadomość?')) return;
    try {
      await this.workspaceService.deleteMessage(
        this.activeWorkspace.id,
        this.activeChannel.id,
        msg.id,
      );
      await this.loadMessages();
    } catch (e: any) {
      alert(e?.error?.message || 'Nie udało się usunąć wiadomości.');
    }
  }

  canDeleteMessage(msg: any): boolean {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return false;
    if (msg.userId === uid) return true;
    return ['OWNER', 'ADMIN'].includes(this.currentUserRole);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
      this.uploadSelectedFile();
      input.value = '';
    }
  }

  async uploadSelectedFile() {
    if (!this.selectedFile || !this.activeWorkspace || !this.activeChannel)
      return;
    this.isUploadingFile = true;
    try {
      await this.workspaceService.uploadFile(
        this.activeWorkspace.id,
        this.activeChannel.id,
        this.selectedFile,
      );
      this.selectedFile = null;
      await this.loadMessages();
    } catch (e) {
      console.error('Błąd uploadu pliku:', e);
      alert('Nie udało się przesłać pliku.');
    } finally {
      this.isUploadingFile = false;
    }
  }

  getFileUrl(url: string): string {
    return `http://localhost:3000${url}`;
  }

  async dismissDeleteNotifications() {
    try {
      await this.workspaceService.markDeleteNotificationsRead();
      this.deleteNotifications = [];
    } catch (e) {
      console.error('Błąd oznaczania powiadomień jako przeczytane:', e);
    }
  }

  async loadWorkspaceRoles(workspaceId: string) {
    try {
      this.workspaceRoles = (await this.workspaceService.getWorkspaceRoles(
        workspaceId,
      )) as any[];
    } catch (e) {
      console.error('Błąd pobierania ról:', e);
    }
  }

  async createWorkspaceRole() {
    if (!this.newRoleName.trim() || !this.activeWorkspace) return;
    this.isCreatingRole = true;
    try {
      await this.workspaceService.createWorkspaceRole(
        this.activeWorkspace.id,
        this.newRoleName.trim(),
        this.newRoleColor,
      );
      await this.loadWorkspaceRoles(this.activeWorkspace.id);
      this.newRoleName = '';
      this.newRoleColor = '#6366f1';
    } catch (e: any) {
      alert(e?.error?.message || 'Nie udało się utworzyć roli.');
    } finally {
      this.isCreatingRole = false;
    }
  }

  async deleteWorkspaceRole(roleId: string) {
    if (!this.activeWorkspace) return;
    if (
      !confirm(
        'Czy na pewno chcesz usunąć tę rolę? Zostanie odebrana wszystkim członkom.',
      )
    )
      return;
    try {
      await this.workspaceService.deleteWorkspaceRole(
        this.activeWorkspace.id,
        roleId,
      );
      await this.loadWorkspaceRoles(this.activeWorkspace.id);
      await this.loadMembers(this.activeWorkspace.id);
    } catch (e: any) {
      alert(e?.error?.message || 'Nie udało się usunąć roli.');
    }
  }

  async assignCustomRole(customRoleId: string | null) {
    if (!this.activeWorkspace || !this.selectedMember) return;
    try {
      await this.workspaceService.assignCustomRole(
        this.activeWorkspace.id,
        this.selectedMember.userId,
        customRoleId,
      );
      await this.loadMembers(this.activeWorkspace.id);
      this.isMemberModalOpen = false;
    } catch (e: any) {
      alert(e?.error?.message || 'Nie udało się przypisać roli.');
    }
  }

  onMessageInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    const cursor = input.selectionStart ?? value.length;
    const textBefore = value.substring(0, cursor);
    const lastAt = textBefore.lastIndexOf('@');

    if (lastAt !== -1) {
      const query = textBefore.substring(lastAt + 1);
      if (!query.includes(' ')) {
        this.mentionSearch = query;
        this.mentionStartIndex = lastAt;
        this.mentionCandidates = this.getMentionCandidates(query);
        this.mentionDropdownOpen = this.mentionCandidates.length > 0;
        return;
      }
    }
    this.mentionDropdownOpen = false;
  }

  getMentionCandidates(query: string): any[] {
    const q = query.toLowerCase();
    const allOption = { id: '__all__' };
    const filtered = this.members.filter((m) => {
      const name = `${m.user?.firstName || ''} ${m.user?.lastName || ''}`
        .toLowerCase()
        .trim();
      const email = (m.user?.email || '').toLowerCase();
      return !q || name.includes(q) || email.includes(q);
    });
    if (!q || 'wszyscy'.includes(q) || 'all'.includes(q)) {
      return [allOption, ...filtered];
    }
    return filtered;
  }

  selectMention(candidate: any) {
    const mentionName =
      candidate.id === '__all__'
        ? 'all'
        : `${candidate.user?.firstName || ''} ${candidate.user?.lastName || ''}`.trim();
    const before = this.newMessageContent.substring(0, this.mentionStartIndex);
    const after = this.newMessageContent.substring(
      this.mentionStartIndex + this.mentionSearch.length + 1,
    );
    this.newMessageContent = `${before}@${mentionName} ${after}`;
    this.mentionDropdownOpen = false;
  }

  onMessageBlur() {
    setTimeout(() => {
      this.mentionDropdownOpen = false;
    }, 150);
  }

  countMembersByRole(customRoleId: string): string {
    const count = this.members.filter(
      (m) => m.customRoleId === customRoleId,
    ).length;
    return count > 0 ? `${count} os.` : '';
  }

  canEditMessage(msg: any): boolean {
    return (
      msg.userId === this.auth.currentUser?.uid && !!msg.content && !msg.fileUrl
    );
  }

  startEditMessage(msg: any) {
    this.editingMessageId = msg.id;
    this.editingContent = msg.content || '';
    this.emojiPickerMsg = null;
  }

  cancelEdit() {
    this.editingMessageId = null;
    this.editingContent = '';
  }

  async saveEditMessage(msg: any) {
    if (
      !this.editingContent.trim() ||
      !this.activeWorkspace ||
      !this.activeChannel
    )
      return;
    this.isSavingEdit = true;
    try {
      await this.workspaceService.editMessage(
        this.activeWorkspace.id,
        this.activeChannel.id,
        msg.id,
        this.editingContent.trim(),
      );
      await this.loadMessages();
      this.cancelEdit();
    } catch (e: any) {
      alert(e?.error?.message || 'Nie udało się edytować wiadomości.');
    } finally {
      this.isSavingEdit = false;
    }
  }

  openEmojiPicker(msg: any, event: MouseEvent) {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.emojiPickerPos = {
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    };
    this.emojiPickerMsg = this.emojiPickerMsg?.id === msg.id ? null : msg;
  }

  async selectReaction(emoji: string) {
    const msg = this.emojiPickerMsg;
    if (!msg || !this.activeWorkspace || !this.activeChannel) return;
    this.emojiPickerMsg = null;
    try {
      await this.workspaceService.addReaction(
        this.activeWorkspace.id,
        this.activeChannel.id,
        msg.id,
        emoji,
      );
      await this.loadMessages();
    } catch (e) {
      console.error('Błąd dodawania reakcji', e);
    }
  }

  async selectReactionDirect(msgId: string, emoji: string) {
    if (!this.activeWorkspace || !this.activeChannel) return;
    try {
      await this.workspaceService.addReaction(
        this.activeWorkspace.id,
        this.activeChannel.id,
        msgId,
        emoji,
      );
      await this.loadMessages();
    } catch (e) {
      console.error('Błąd reakcji', e);
    }
  }

  getReactionGroups(
    msg: any,
  ): { emoji: string; count: number; hasMe: boolean }[] {
    if (!msg.reactions?.length) return [];
    const myUid = this.auth.currentUser?.uid;
    const groups: Record<string, { count: number; hasMe: boolean }> = {};
    for (const r of msg.reactions) {
      if (!groups[r.emoji]) groups[r.emoji] = { count: 0, hasMe: false };
      groups[r.emoji].count++;
      if (r.userId === myUid) groups[r.emoji].hasMe = true;
    }
    return Object.entries(groups).map(([emoji, data]) => ({ emoji, ...data }));
  }

  openUserPopover(member: any, event: MouseEvent) {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const popoverWidth = 224;
    const spaceRight = window.innerWidth - rect.right - 8;
    const left =
      spaceRight >= popoverWidth
        ? rect.right + 8
        : Math.max(rect.left - popoverWidth - 8, 8);
    const top = Math.min(rect.top, window.innerHeight - 260);
    this.userPopoverPos = { top, left };
    this.userPopoverMember = member;
  }

  openUserPopoverFromMessage(msg: any, event: MouseEvent) {
    const member = this.members.find((m) => m.userId === msg.userId);
    if (member) {
      this.openUserPopover(member, event);
    }
  }

  closeUserPopover() {
    this.userPopoverMember = null;
  }

  setActiveView(view: 'overview' | 'channel' | 'tasks') {
    this.activeView = view;
    if (view === 'tasks' && this.activeWorkspace) {
      this.loadTasks(this.activeWorkspace.id);
    }
  }

  async loadTasks(workspaceId: string) {
    try {
      this.tasks = (await this.workspaceService.getTasks(workspaceId)) as any[];
    } catch (e) {
      console.error('Błąd pobierania zadań', e);
    }
  }

  tasksByStatus(status: string): any[] {
    return this.tasks.filter((t) => t.status === status);
  }

  async createTask() {
    if (!this.newTask.title.trim() || !this.activeWorkspace) return;
    this.isCreatingTask = true;
    try {
      await this.workspaceService.createTask(this.activeWorkspace.id, {
        title: this.newTask.title.trim(),
        description: this.newTask.description || undefined,
        priority: this.newTask.priority,
        assigneeIds: this.newTask.assigneeIds.length ? this.newTask.assigneeIds : undefined,
        dueDate: this.newTask.dueDate || undefined,
      });
      await this.loadTasks(this.activeWorkspace.id);
      this.isCreateTaskModalOpen = false;
      this.newTask = {
        title: '',
        description: '',
        priority: 'MEDIUM',
        assigneeIds: [],
        dueDate: '',
      };
    } catch (e: any) {
      alert(e?.error?.message || 'Nie udało się utworzyć zadania.');
    } finally {
      this.isCreatingTask = false;
    }
  }

  async updateTaskStatus(task: any, status: string) {
    if (!this.activeWorkspace) return;
    try {
      await this.workspaceService.updateTask(this.activeWorkspace.id, task.id, {
        status,
      });
      await this.loadTasks(this.activeWorkspace.id);
    } catch (e) {
      console.error('Błąd zmiany statusu zadania', e);
    }
  }

  async removeTask(task: any) {
    if (!this.activeWorkspace) return;
    if (!confirm('Czy na pewno chcesz usunąć to zadanie?')) return;
    try {
      await this.workspaceService.deleteTask(this.activeWorkspace.id, task.id);
      await this.loadTasks(this.activeWorkspace.id);
    } catch (e: any) {
      alert(e?.error?.message || 'Nie udało się usunąć zadania.');
    }
  }

  priorityLabel(priority: string): string {
    return (
      { LOW: 'Niski', MEDIUM: 'Średni', HIGH: 'Wysoki', URGENT: 'Pilny' }[
        priority
      ] ?? priority
    );
  }

  priorityBadgeClass(priority: string): string {
    return (
      {
        LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
        MEDIUM:
          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      }[priority] ?? ''
    );
  }

  getTaskAssignees(task: any): any[] {
    if (!task.assigneeIds?.length) return [];
    return this.members.filter((m) => task.assigneeIds.includes(m.userId));
  }

  getTaskAssigneeInitials(member: any): string {
    const f = member.user?.firstName?.[0] || '';
    const l = member.user?.lastName?.[0] || '';
    return (f + l).toUpperCase() || member.user?.email?.[0]?.toUpperCase() || '?';
  }

  myActiveTasks(): any[] {
    const uid = this.auth.currentUser?.uid;
    return this.tasks.filter(
      (t) => t.status !== 'DONE' && t.assigneeIds?.includes(uid),
    );
  }

  activeTasksCount(): number {
    return this.tasks.filter((t) => t.status !== 'DONE').length;
  }

  toggleTaskAssignee(userId: string) {
    const idx = this.newTask.assigneeIds.indexOf(userId);
    if (idx === -1) {
      this.newTask.assigneeIds = [...this.newTask.assigneeIds, userId];
    } else {
      this.newTask.assigneeIds = this.newTask.assigneeIds.filter((id) => id !== userId);
    }
  }

  assignRoleToTask(customRoleId: string) {
    const roleMembers = this.members
      .filter((m) => m.customRoleId === customRoleId)
      .map((m) => m.userId);
    const allSelected = roleMembers.every((id) => this.newTask.assigneeIds.includes(id));
    if (allSelected) {
      this.newTask.assigneeIds = this.newTask.assigneeIds.filter(
        (id) => !roleMembers.includes(id),
      );
    } else {
      const merged = new Set([...this.newTask.assigneeIds, ...roleMembers]);
      this.newTask.assigneeIds = Array.from(merged);
    }
  }

  isRoleFullySelected(customRoleId: string): boolean {
    const roleMembers = this.members.filter((m) => m.customRoleId === customRoleId);
    return roleMembers.length > 0 && roleMembers.every((m) => this.newTask.assigneeIds.includes(m.userId));
  }

  renderContent(content: string | null | undefined): SafeHtml {
    if (!content) return this.sanitizer.bypassSecurityTrustHtml('');
    const escapedHtml = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    const names = [
      'all',
      ...this.members
        .map((m) =>
          `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.trim(),
        )
        .filter(Boolean),
    ].sort((a, b) => b.length - a.length);

    const mentionPatterns = names.map((n) =>
      n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
    const pattern = new RegExp(
      `@(${mentionPatterns.join('|')})(?=[\\s,.:!?;"']|$|<)`,
      'gi',
    );

    const highlighted = escapedHtml.replace(
      pattern,
      '<span class="text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-900/30 rounded px-0.5">@$1</span>',
    );
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }

  isMentionedInMessage(content: string | null | undefined): boolean {
    if (!content || !this.myProfile) return false;
    const myName =
      `${this.myProfile.firstName || ''} ${this.myProfile.lastName || ''}`
        .trim()
        .toLowerCase();
    const lower = content.toLowerCase();
    return lower.includes('@all') || (!!myName && lower.includes(`@${myName}`));
  }
}
