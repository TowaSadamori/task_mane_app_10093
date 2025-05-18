// src/app/core/components/navigation/navigation.component.ts
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../auth.service'; // パスが正しいか確認

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [
    RouterLink,
    MatListModule,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.scss'
})
export class NavigationComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
      this.router.navigate(['/login']); // ログインページのパスに合わせて変更してください
      console.log('Logged out successfully from navigation');
    } catch (error) {
      console.error('Logout failed from navigation:', error);
    }
  }
}