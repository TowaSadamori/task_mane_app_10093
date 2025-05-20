import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router'; // Router をインポート
import { AuthService } from '../../auth.service'; // AuthService のパスを確認・修正してください
import { CommonModule } from '@angular/common'; // CommonModule を追加 (ngFor, ngIf などを使う場合)
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-navigation',
standalone: true,
 imports: [CommonModule, RouterLink, MatIconModule, MatTooltipModule], // CommonModule を追加, RouterLink を修正, MatTooltipModule を追加
 templateUrl: './navigation.component.html',
 styleUrl: './navigation.component.scss'
})
export class NavigationComponent {

  constructor(
  private authService: AuthService,
 private router: Router
) {}

onLogout(): void {
  this.authService.logout().then(() => {
   console.log('ログアウトしました');
 this.router.navigate(['/login']);
 })
 .catch(error => {
  console.error('ログアウト失敗', error);
});
 }
}
