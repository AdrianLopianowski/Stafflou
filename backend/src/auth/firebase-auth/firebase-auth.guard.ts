import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';

// Straznik autoryzacji
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // Sprawdzenie tokenu
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Brak tokenu dostępu. Zaloguj się w aplikacji.',
      );
    }

    // Pobranie tokenu
    const token = authHeader.split(' ')[1];

    try {
      // Weryfikacja tokenu
      const decodedToken = await admin.auth().verifyIdToken(token);

      // Przypisanie uzytkownika
      request.user = decodedToken;

      return true;
    } catch (error) {
      console.error('Błąd weryfikacji tokenu:', error);
      throw new UnauthorizedException('Token jest nieprawidłowy lub wygasł.');
    }
  }
}

