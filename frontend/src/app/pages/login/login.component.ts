import { Component, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import {
  Auth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from '@angular/fire/auth';

import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

// Komponent logowania
@Component({
  selector: 'app-login',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private auth = inject(Auth);
  private router = inject(Router);
  private http = inject(HttpClient);
  private themeService = inject(ThemeService);

  errorMessage: string | null = null;
  isLoading: boolean = false;

  // Definicja formularza
  loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  // Synchronizacja z backendem
  private async syncUserWithBackend(user: any) {
    const token = await user.getIdToken();

    await firstValueFrom(
      this.http.post(
        'http://localhost:3000/auth/sync',
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );
  }

  // Obsluga wyslania
  async onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = null;

      const email = this.loginForm.value.email!;
      const password = this.loginForm.value.password!;

      try {
        const userCredential = await signInWithEmailAndPassword(
          this.auth,
          email,
          password,
        );

        if (!userCredential.user.emailVerified) {
          await signOut(this.auth);
          this.router.navigate(['/verify-email']);
        } else {
          await this.syncUserWithBackend(userCredential.user);
          this.router.navigate(['/dashboard']);
        }
      } catch (error: any) {
        console.error('Prawdziwy błąd logowania:', error);

        if (error.code) {
          this.errorMessage = 'Błędny adres e-mail lub hasło.';
        } else {
          await signOut(this.auth);
          this.errorMessage =
            'Błąd synchronizacji z serwerem. Sprawdź konsolę (F12).';
        }
      } finally {
        this.isLoading = false;
      }
    } else {
      this.loginForm.markAllAsTouched();
    }
  }

  // Logowanie przez Google
  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(this.auth, provider);

      await this.syncUserWithBackend(userCredential.user);

      this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error('Błąd logowania Google:', error);
      this.errorMessage = 'Wystąpił błąd podczas logowania przez Google.';
    }
  }
}

