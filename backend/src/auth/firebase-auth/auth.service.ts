import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Serwis autoryzacji
@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  // Synchronizacja uzytkownika
  async syncUser(firebaseUser: any) {
    const user = await this.prisma.user.upsert({
      where: {
        email: firebaseUser.email,
      },
      update: {
        id: firebaseUser.uid,
      },
      create: {
        id: firebaseUser.uid,
        email: firebaseUser.email,
      },
    });

    console.log('✅ Zsynchronizowano użytkownika w bazie:', user.email);

    return user;
  }
}

