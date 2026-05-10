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
  taskNotifications: any[] = [];
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
  readonly quickEmojis = ['👍', '❤️', '😂', '🎉', '😮', '😢', '🔥', '✅', '👎'];

  userPopoverMember: any = null;
  userPopoverPos = { top: 0, left: 0 };

  activeView: 'overview' | 'channel' | 'tasks' | 'team' = 'overview';
  memberSearchQuery = '';

  pinnedMessages: any[] = [];
  isPinnedPanelOpen = false;

  polls: any[] = [];
  isCreatePollOpen = false;
  newPoll: { question: string; options: string[]; isMultiple: boolean } = {
    question: '',
    options: ['', ''],
    isMultiple: false,
  };
  isWorkspaceSelectorOpen = false;

  tasks: any[] = [];
  tasksView: 'kanban' | 'results' = 'kanban';
  isCreateTaskModalOpen = false;
  isTeamModalOpen = false;
  taskAttachmentFile: File | null = null;
  statsTimePeriod: 'all' | 'week' | 'month' | 'year' = 'all';
  statsFilterType: 'all' | 'role' | 'member' = 'all';
  statsFilterId = '';

  newTask = {
    title: '',
    description: '',
    priority: 'MEDIUM',
    assigneeIds: [] as string[],
    dueDate: '',
    submissionType: 'NONE',
    submissionMode: 'INDIVIDUAL',
  };
  isCreatingTask = false;

  isSubmitModalOpen = false;
  submitTaskTarget: any = null;
  submitText = '';
  submitFiles: File[] = [];
  isSubmitting = false;

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
          this.loadTaskNotifications(),
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
          this.loadTasks(this.activeWorkspace.id),
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

  async loadPolls() {
    if (!this.activeWorkspace || !this.activeChannel) return;
    try {
      this.polls = (await this.workspaceService.getPolls(
        this.activeWorkspace.id,
        this.activeChannel.id,
      )) as any[];
    } catch (e) {
      console.error('Błąd pobierania ankiet', e);
    }
  }

  async loadPinnedMessages() {
    if (!this.activeWorkspace || !this.activeChannel) return;
    try {
      this.pinnedMessages = (await this.workspaceService.getPinnedMessages(
        this.activeWorkspace.id,
        this.activeChannel.id,
      )) as any[];
    } catch (e) {
      console.error('Błąd pobierania przypiętych wiadomości', e);
    }
  }

  get mergedFeed(): any[] {
    const msgs = this.messages.map((m) => ({ ...m, _type: 'message' }));
    const polls = this.polls.map((p) => ({ ...p, _type: 'poll' }));
    return [...msgs, ...polls].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  async togglePin(msg: any) {
    if (!this.activeWorkspace || !this.activeChannel) return;
    await this.workspaceService.pinMessage(
      this.activeWorkspace.id,
      this.activeChannel.id,
      msg.id,
    );
    await Promise.all([this.loadMessages(), this.loadPinnedMessages()]);
  }

  async submitCreatePoll() {
    if (!this.activeWorkspace || !this.activeChannel) return;
    const opts = this.newPoll.options.filter((o) => o.trim());
    if (!this.newPoll.question.trim() || opts.length < 2) return;
    try {
      await this.workspaceService.createPoll(
        this.activeWorkspace.id,
        this.activeChannel.id,
        { question: this.newPoll.question, options: opts, isMultiple: this.newPoll.isMultiple },
      );
      this.newPoll = { question: '', options: ['', ''], isMultiple: false };
      this.isCreatePollOpen = false;
      await this.loadPolls();
    } catch (e: any) {
      alert(e?.error?.message || 'Nie udało się utworzyć ankiety.');
    }
  }

  async doVotePoll(poll: any, optionId: string) {
    if (!this.activeWorkspace || !this.activeChannel || poll.isClosed) return;
    await this.workspaceService.votePoll(
      this.activeWorkspace.id,
      this.activeChannel.id,
      poll.id,
      optionId,
    );
    await this.loadPolls();
  }

  async doClosePoll(poll: any) {
    if (!this.activeWorkspace || !this.activeChannel) return;
    await this.workspaceService.closePoll(
      this.activeWorkspace.id,
      this.activeChannel.id,
      poll.id,
    );
    await this.loadPolls();
  }

  canCreatePoll(): boolean {
    return (
      !!this.newPoll.question.trim() &&
      this.newPoll.options.filter((o) => o.trim()).length >= 2
    );
  }

  addPollOption() {
    if (this.newPoll.options.length < 6) this.newPoll.options.push('');
  }

  removePollOption(i: number) {
    if (this.newPoll.options.length > 2) this.newPoll.options.splice(i, 1);
  }

  pollTotalVotes(poll: any): number {
    return (poll.options as any[])?.reduce(
      (s: number, o: any) => s + (o.voterIds?.length || 0),
      0,
    ) ?? 0;
  }

  hasVotedOption(poll: any, optionId: string): boolean {
    const uid = this.auth.currentUser?.uid;
    return poll.options?.find((o: any) => o.id === optionId)?.voterIds?.includes(uid) ?? false;
  }

  hasVotedInPoll(poll: any): boolean {
    const uid = this.auth.currentUser?.uid;
    return poll.options?.some((o: any) => o.voterIds?.includes(uid)) ?? false;
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
    this.isPinnedPanelOpen = false;
    this.polls = [];
    this.pinnedMessages = [];
    await Promise.all([this.loadMessages(), this.loadPolls(), this.loadPinnedMessages()]);
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

  get minDueDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  get maxDueDate(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  }

  clampDueDate() {
    if (this.newTask.dueDate && this.newTask.dueDate < this.minDueDate) {
      this.newTask.dueDate = this.minDueDate;
    }
    if (this.newTask.dueDate && this.newTask.dueDate > this.maxDueDate) {
      this.newTask.dueDate = this.maxDueDate;
    }
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
      this.loadTasks(workspace.id),
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
        this.loadTaskNotifications(),
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

  async loadTaskNotifications() {
    try {
      const data: any = await this.workspaceService.getTaskNotifications();
      this.taskNotifications = data || [];
    } catch (e) {
      console.error('Błąd pobierania powiadomień o zadaniach:', e);
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

  async dismissTaskNotifications() {
    try {
      await this.workspaceService.markTaskNotificationsRead();
      this.taskNotifications = [];
    } catch (e) {
      console.error('Błąd oznaczania powiadomień o zadaniach jako przeczytane:', e);
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

  async toggleCustomRole(customRoleId: string) {
    if (!this.activeWorkspace || !this.selectedMember) return;
    try {
      await this.workspaceService.assignCustomRole(
        this.activeWorkspace.id,
        this.selectedMember.userId,
        customRoleId,
      );
      const updated: any = await this.workspaceService.getMembers(
        this.activeWorkspace.id,
      );
      this.members = updated;
      this.selectedMember = this.members.find(
        (m) => m.userId === this.selectedMember.userId,
      );
    } catch (e: any) {
      alert(e?.error?.message || 'Nie udało się przypisać roli.');
    }
  }

  getMemberCustomRoles(member: any): any[] {
    if (!member.customRoleIds?.length) return [];
    return this.workspaceRoles.filter((r) =>
      member.customRoleIds.includes(r.id),
    );
  }

  getMemberTaskStats(userId: string): { assigned: number; done: number; inProgress: number } {
    const assigned = this.tasks.filter((t) => t.assigneeIds?.includes(userId));
    const done = assigned.filter((t) => {
      if (t.submissionMode === 'INDIVIDUAL') return t.completedByIds?.includes(userId);
      return t.status === 'DONE';
    });
    const inProgress = assigned.filter((t) => {
      if (t.submissionMode === 'INDIVIDUAL') return t.inProgressByIds?.includes(userId) && !t.completedByIds?.includes(userId);
      return t.status === 'IN_PROGRESS';
    });
    return { assigned: assigned.length, done: done.length, inProgress: inProgress.length };
  }

  filteredMembersForPanel(): any[] {
    const q = this.memberSearchQuery.trim().toLowerCase();
    if (!q) return this.members;
    return this.members.filter((m) => {
      const name = `${m.user?.firstName ?? ''} ${m.user?.lastName ?? ''}`.toLowerCase();
      const email = (m.user?.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }

  filteredMembersByRole(role: string): any[] {
    return this.filteredMembersForPanel().filter((m) => m.role === role);
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
    const count = this.members.filter((m) =>
      m.customRoleIds?.includes(customRoleId),
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

  setActiveView(view: 'overview' | 'channel' | 'tasks' | 'team') {
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

  effectiveStatus(task: any): string {
    const uid = this.auth.currentUser?.uid;
    if (task.submissionMode === 'INDIVIDUAL' && uid && task.assigneeIds?.includes(uid)) {
      if (task.completedByIds?.includes(uid)) return 'DONE';
      if (task.inProgressByIds?.includes(uid)) return 'IN_PROGRESS';
      return 'TODO';
    }
    return task.status;
  }

  tasksByStatus(status: string): any[] {
    return this.tasks.filter((t) => this.effectiveStatus(t) === status);
  }

  async createTask() {
    if (!this.newTask.title.trim() || !this.activeWorkspace) return;
    this.isCreatingTask = true;
    try {
      await this.workspaceService.createTask(
        this.activeWorkspace.id,
        {
          title: this.newTask.title.trim(),
          description: this.newTask.description || undefined,
          priority: this.newTask.priority,
          assigneeIds: this.newTask.assigneeIds.length
            ? this.newTask.assigneeIds
            : undefined,
          dueDate: this.newTask.dueDate || undefined,
          submissionType: this.newTask.submissionType,
          submissionMode: this.newTask.submissionMode,
        },
        this.taskAttachmentFile,
      );
      await this.loadTasks(this.activeWorkspace.id);
      this.isCreateTaskModalOpen = false;
      this.taskAttachmentFile = null;
      this.newTask = {
        title: '',
        description: '',
        priority: 'MEDIUM',
        assigneeIds: [],
        dueDate: '',
        submissionType: 'NONE',
        submissionMode: 'INDIVIDUAL',
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
    return (
      (f + l).toUpperCase() || member.user?.email?.[0]?.toUpperCase() || '?'
    );
  }

  myActiveTasks(): any[] {
    const uid = this.auth.currentUser?.uid;
    return this.tasks.filter(
      (t) => this.effectiveStatus(t) !== 'DONE' && t.assigneeIds?.includes(uid),
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
      this.newTask.assigneeIds = this.newTask.assigneeIds.filter(
        (id) => id !== userId,
      );
    }
  }

  assignRoleToTask(customRoleId: string) {
    const roleMembers = this.members
      .filter((m) => m.customRoleIds?.includes(customRoleId))
      .map((m) => m.userId);
    const allSelected = roleMembers.every((id) =>
      this.newTask.assigneeIds.includes(id),
    );
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
    const roleMembers = this.members.filter((m) =>
      m.customRoleIds?.includes(customRoleId),
    );
    return (
      roleMembers.length > 0 &&
      roleMembers.every((m) => this.newTask.assigneeIds.includes(m.userId))
    );
  }

  onTaskAttachmentSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      const file = input.files[0];
      const maxMB = 20;
      if (file.size > maxMB * 1024 * 1024) {
        alert(`Plik jest za duży. Maksymalny rozmiar to ${maxMB} MB.`);
        input.value = '';
        return;
      }
      this.taskAttachmentFile = file;
    }
  }

  deadlineBadgeClass(task: any): string {
    if (!task.dueDate || this.effectiveStatus(task) === 'DONE')
      return 'text-gray-400 dark:text-gray-500';
    const diff = new Date(task.dueDate).getTime() - Date.now();
    const days = diff / 86400000;
    if (days < 0) return 'text-red-600 dark:text-red-400 font-bold';
    if (days < 1) return 'text-orange-500 dark:text-orange-400 font-semibold';
    if (days < 3) return 'text-yellow-600 dark:text-yellow-500 font-semibold';
    return 'text-gray-400 dark:text-gray-500';
  }

  deadlineIcon(task: any): string {
    if (!task.dueDate || this.effectiveStatus(task) === 'DONE') return '';
    const diff = new Date(task.dueDate).getTime() - Date.now();
    const days = diff / 86400000;
    if (days < 0) return '⚠ ';
    if (days < 1) return '🔥 ';
    return '';
  }

  canSubmitTask(task: any): boolean {
    if (task.submissionType === 'NONE') return false;
    if (this.effectiveStatus(task) !== 'IN_PROGRESS') return false;
    const uid = this.auth.currentUser?.uid;
    return task.assigneeIds?.includes(uid) ?? false;
  }

  openSubmitModal(task: any) {
    this.submitTaskTarget = task;
    this.submitText = '';
    this.submitFiles = [];
    this.isSubmitModalOpen = true;
  }

  onSubmitFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const maxMB = 10;
    const remaining = 4 - this.submitFiles.length;
    const toAdd = Array.from(input.files).slice(0, remaining);
    const oversized = toAdd.filter((f) => f.size > maxMB * 1024 * 1024);
    if (oversized.length) {
      alert(`Niektóre pliki są za duże. Maksymalny rozmiar to ${maxMB} MB.`);
      input.value = '';
      return;
    }
    this.submitFiles = [...this.submitFiles, ...toAdd];
    input.value = '';
  }

  removeSubmitFile(index: number) {
    this.submitFiles = this.submitFiles.filter((_, i) => i !== index);
  }

  async submitTaskResult() {
    if (!this.submitTaskTarget || !this.activeWorkspace) return;
    const t = this.submitTaskTarget;
    const needsText = t.submissionType === 'TEXT' || t.submissionType === 'BOTH';
    const needsFile = t.submissionType === 'FILE' || t.submissionType === 'BOTH';
    if (needsText && !this.submitText.trim()) return;
    if (needsFile && !this.submitFiles.length) return;
    this.isSubmitting = true;
    try {
      await this.workspaceService.submitTask(
        this.activeWorkspace.id,
        t.id,
        { textContent: this.submitText || undefined },
        this.submitFiles.length ? this.submitFiles : undefined,
      );
      await this.loadTasks(this.activeWorkspace.id);
      this.isSubmitModalOpen = false;
    } catch (e: any) {
      alert(e?.error?.message || 'Nie udało się przesłać wyniku.');
    } finally {
      this.isSubmitting = false;
    }
  }

  myCreatedTasksWithSubmissions(): any[] {
    const uid = this.auth.currentUser?.uid;
    return this.tasks.filter(
      (t) =>
        t.createdById === uid &&
        t.submissionType !== 'NONE' &&
        t.submissions?.length > 0,
    );
  }

  getSubmitterName(submittedById: string): string {
    const m = this.members.find((m) => m.userId === submittedById);
    if (!m) return submittedById;
    return m.user?.firstName && m.user?.lastName
      ? `${m.user.firstName} ${m.user.lastName}`
      : m.user?.email || submittedById;
  }

  submissionTypeLabel(type: string): string {
    return (
      { NONE: 'Brak', TEXT: 'Opis tekstowy', FILE: 'Plik', BOTH: 'Opis i plik' }[
        type
      ] ?? type
    );
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

  submissionModeLabel(mode: string): string {
    return (
      { INDIVIDUAL: 'Indywidualnie', GROUP: 'Grupowo' }[mode] ?? mode
    );
  }

  getStatsTasksInPeriod(): any[] {
    const done = this.tasks.filter((t) => t.status === 'DONE');
    if (this.statsTimePeriod === 'all') return done;
    const now = Date.now();
    const ms = ({ week: 7, month: 30, year: 365 } as Record<string, number>)[this.statsTimePeriod] * 86400000;
    return done.filter((t) => new Date(t.updatedAt).getTime() >= now - ms);
  }

  getFilteredDoneTasksCount(): number {
    let tasks = this.getStatsTasksInPeriod();
    if (this.statsFilterType === 'role' && this.statsFilterId) {
      const roleUserIds = this.members
        .filter((m) => m.customRoleIds?.includes(this.statsFilterId))
        .map((m) => m.userId);
      tasks = tasks.filter((t) =>
        t.assigneeIds?.some((id: string) => roleUserIds.includes(id)),
      );
    } else if (this.statsFilterType === 'member' && this.statsFilterId) {
      tasks = tasks.filter((t) => t.assigneeIds?.includes(this.statsFilterId));
    }
    return tasks.length;
  }

  getMyDoneTasksCount(): number {
    const uid = this.auth.currentUser?.uid;
    let tasks = this.tasks.filter(
      (t) => t.status === 'DONE' && t.assigneeIds?.includes(uid),
    );
    if (this.statsTimePeriod === 'all') return tasks.length;
    const now = Date.now();
    const ms = ({ week: 7, month: 30, year: 365 } as Record<string, number>)[this.statsTimePeriod] * 86400000;
    return tasks.filter((t) => new Date(t.updatedAt).getTime() >= now - ms).length;
  }

  myAssignedTasksCount(): number {
    const uid = this.auth.currentUser?.uid;
    return this.tasks.filter((t) => t.assigneeIds?.includes(uid)).length;
  }

  onStatsMemberFilterChange(userId: string) {
    if (userId) {
      this.statsFilterType = 'member';
      this.statsFilterId = userId;
    } else {
      this.statsFilterType = 'all';
      this.statsFilterId = '';
    }
  }
}
