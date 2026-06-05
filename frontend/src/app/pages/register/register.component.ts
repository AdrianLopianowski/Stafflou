import { Component, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { ThemeService } from '../../services/theme.service';

import {
  Auth,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from '@angular/fire/auth';

// Walidator hasla
function passwordValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value || '';
  const hasUppercase = /[A-Z]/.test(value);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(value);

  const errors: any = {};
  if (!hasUppercase) errors.uppercase = true;
  if (!hasSpecialChar) errors.specialChar = true;

  return Object.keys(errors).length > 0 ? errors : null;
}

// Komponent rejestracji
@Component({
  selector: 'app-register',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  private auth = inject(Auth);
  private router = inject(Router);
  private themeService = inject(ThemeService);

  errorMessage: string | null = null;
  isLoading: boolean = false;

  // Definicja formularza
  registerForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(8),
      passwordValidator,
    ]),
  });

  // Obsluga wyslania
  async onSubmit() {
    if (this.registerForm.valid) {
      this.isLoading = true;
      this.errorMessage = null;

      const email = this.registerForm.value.email!;
      const password = this.registerForm.value.password!;

      try {
        const userCredential = await createUserWithEmailAndPassword(
          this.auth,
          email,
          password,
        );

        await sendEmailVerification(userCredential.user);

        await signOut(this.auth);

        this.router.navigate(['/verify-email']);
      } catch (error: any) {
        console.error('Błąd Firebase:', error);
        if (error.code === 'auth/email-already-in-use') {
          this.errorMessage = 'Ten adres e-mail jest już zajęty.';
        } else {
          this.errorMessage =
            'Wystąpił błąd podczas rejestracji. Spróbuj ponownie.';
        }
      } finally {
        this.isLoading = false;
      }
    } else {
      this.registerForm.markAllAsTouched();
    }
  }

  // Logowanie przez Google
  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(this.auth, provider);
      this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error('Błąd logowania Google:', error);
      this.errorMessage = 'Wystąpił błąd podczas łączenia z kontem Google.';
    }
  }
}

