import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import { CommonModule } from '@angular/common'; // ★ CommonModule をインポート
import { UserCreateComponent } from '../../admin/components/user-create/user-create.component'; // ★ UserCreateComponent をインポート

@Component({
  selector: 'app-user-settings',
  standalone: true,
  templateUrl: './user-settings.component.html',
  styleUrls: ['./user-settings.component.scss'],
  imports: [
    CommonModule,         // ★ CommonModule を追加 (asyncパイプのため)
    UserCreateComponent   // ★ UserCreateComponent を追加
  ]
})
export class UserSettingsComponent {
  public authService = inject(AuthService);
}