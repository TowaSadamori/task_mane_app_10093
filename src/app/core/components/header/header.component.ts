import { Component } from '@angular/core';
import { AuthService } from '../../auth.service'; // AuthService のパスは実際の構成に合わせてください
import { Observable } from 'rxjs';
import { User } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
// import { Router } from '@angular/router'; // ログアウト処理がなくなったため不要になる可能性
import { RouterModule } from '@angular/router'; // routerLink などで RouterModule が必要なら残す

@Component({
  selector: 'app-header',
   standalone: true,
   imports: [CommonModule, RouterModule], // RouterModule が不要なら削除も検討
   templateUrl: './header.component.html',
   styleUrl: './header.component.scss'
})
export class HeaderComponent {
  user$: Observable<User | null>;

  constructor(
    private authService: AuthService
     // private router: Router // ログアウト処理がなくなったため不要になる可能性
     ) {
       this.user$ = this.authService.authState$;
       }

       // onLogout メソッドは削除
}
