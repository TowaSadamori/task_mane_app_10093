import { Component } from '@angular/core';
import { AuthService } from '../../auth.service';
import { Observable } from 'rxjs';
import { User } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})

export class HeaderComponent {
  user$: Observable<User | null>;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.user$ = this.authService.authState$;
  }

  onLogout(): void {
    this.authService.logout().then(()=> {
      console.log('ログアウトしました');
      this.router.navigate(['/login']);
    })
    .catch(error => {
      console.error('ログアウト失敗', error);
    });
  }

}
