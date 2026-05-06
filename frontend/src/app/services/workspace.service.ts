import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WorkspaceService {
  private http = inject(HttpClient);
  private auth = inject(Auth);

  private apiUrl = 'http://localhost:3000/workspaces';

  private async getHeaders() {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Użytkownik nie jest zalogowany!');
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }

  async createWorkspace(name: string) {
    const headers = await this.getHeaders();
    return firstValueFrom(this.http.post(this.apiUrl, { name }, { headers }));
  }

  async getMyWorkspaces() {
    const headers = await this.getHeaders();
    return firstValueFrom(this.http.get(this.apiUrl, { headers }));
  }

  async getChannels(workspaceId: string) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.get(`${this.apiUrl}/${workspaceId}/channels`, { headers }),
    );
  }
  async getMyProfile() {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.get(`http://localhost:3000/users/me`, { headers }),
    );
  }

  async updateMyProfile(data: {
    firstName: string;
    lastName: string;
    location: string;
  }) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.patch(`http://localhost:3000/users/me`, data, { headers }),
    );
  }

  async createChannel(workspaceId: string, name: string, type: string) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.post(
        `${this.apiUrl}/${workspaceId}/channels`,
        { name, type },
        { headers },
      ),
    );
  }
  async getMessages(workspaceId: string, channelId: string) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.get(
        `${this.apiUrl}/${workspaceId}/channels/${channelId}/messages`,
        { headers },
      ),
    );
  }

  async sendMessage(workspaceId: string, channelId: string, content: string) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.post(
        `${this.apiUrl}/${workspaceId}/channels/${channelId}/messages`,
        { content },
        { headers },
      ),
    );
  }

  async uploadFile(
    workspaceId: string,
    channelId: string,
    file: File,
    content?: string,
  ) {
    const headers = await this.getHeaders();
    const formData = new FormData();
    formData.append('file', file);
    if (content) formData.append('content', content);
    return firstValueFrom(
      this.http.post(
        `${this.apiUrl}/${workspaceId}/channels/${channelId}/messages/upload`,
        formData,
        { headers },
      ),
    );
  }

  async deleteMessage(
    workspaceId: string,
    channelId: string,
    messageId: string,
  ) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.delete(
        `${this.apiUrl}/${workspaceId}/channels/${channelId}/messages/${messageId}`,
        { headers },
      ),
    );
  }

  async editMessage(
    workspaceId: string,
    channelId: string,
    messageId: string,
    content: string,
  ) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.patch(
        `${this.apiUrl}/${workspaceId}/channels/${channelId}/messages/${messageId}`,
        { content },
        { headers },
      ),
    );
  }

  async addReaction(
    workspaceId: string,
    channelId: string,
    messageId: string,
    emoji: string,
  ) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.post(
        `${this.apiUrl}/${workspaceId}/channels/${channelId}/messages/${messageId}/reactions`,
        { emoji },
        { headers },
      ),
    );
  }

  async getDeleteNotifications() {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.get(`${this.apiUrl}/notifications/deleted`, { headers }),
    );
  }

  async markDeleteNotificationsRead() {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.patch(
        `${this.apiUrl}/notifications/deleted/read`,
        {},
        { headers },
      ),
    );
  }
  async getMyInvitations() {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.get(`http://localhost:3000/invitations/my`, { headers }),
    );
  }

  async acceptInvitation(id: string) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.post(
        `http://localhost:3000/invitations/${id}/accept`,
        {},
        { headers },
      ),
    );
  }

  async getMembers(workspaceId: string) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.get(`${this.apiUrl}/${workspaceId}/members`, { headers }),
    );
  }

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER',
  ) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.patch(
        `${this.apiUrl}/${workspaceId}/members/${userId}/role`,
        { role },
        { headers },
      ),
    );
  }

  async removeMember(workspaceId: string, userId: string) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.delete(`${this.apiUrl}/${workspaceId}/members/${userId}`, {
        headers,
      }),
    );
  }

  async inviteUser(workspaceId: string, email: string) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.post(
        `http://localhost:3000/invitations/invite/${workspaceId}`,
        { email },
        { headers },
      ),
    );
  }

  async getWorkspaceRoles(workspaceId: string) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.get(`${this.apiUrl}/${workspaceId}/roles`, { headers }),
    );
  }

  async createWorkspaceRole(workspaceId: string, name: string, color: string) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.post(
        `${this.apiUrl}/${workspaceId}/roles`,
        { name, color },
        { headers },
      ),
    );
  }

  async updateWorkspaceRole(
    workspaceId: string,
    roleId: string,
    name: string,
    color: string,
  ) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.patch(
        `${this.apiUrl}/${workspaceId}/roles/${roleId}`,
        { name, color },
        { headers },
      ),
    );
  }

  async deleteWorkspaceRole(workspaceId: string, roleId: string) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.delete(`${this.apiUrl}/${workspaceId}/roles/${roleId}`, {
        headers,
      }),
    );
  }

  async assignCustomRole(
    workspaceId: string,
    userId: string,
    customRoleId: string | null,
  ) {
    const headers = await this.getHeaders();
    return firstValueFrom(
      this.http.patch(
        `${this.apiUrl}/${workspaceId}/members/${userId}/custom-role`,
        { customRoleId },
        { headers },
      ),
    );
  }
}
