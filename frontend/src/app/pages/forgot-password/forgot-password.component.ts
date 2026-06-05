import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { inject } from '@angular/core';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';

// Komponent resetowania hasla
@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent {
  public themeService = inject(ThemeService);

  // Definicja formularza
  forgotPasswordForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  // Obsluga wyslania
  onSubmit() {
    if (this.forgotPasswordForm.valid) {
      console.log(
        'Wysyłam link resetujący na:',
        this.forgotPasswordForm.value.email,
      );
    } else {
      this.forgotPasswordForm.markAllAsTouched();
    }
  }
}

