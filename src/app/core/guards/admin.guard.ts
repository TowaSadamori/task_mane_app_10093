import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { take, switchMap, catchError } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { User as FirebaseUser } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.authService.authState$.pipe(
      take(1),
      switchMap(async (user: FirebaseUser | null) => {
        if (user) {
          const idTokenResult = await user.getIdTokenResult();
          if (idTokenResult && idTokenResult.claims['role'] === 'admin') {
            console.log('AdminGuard: User is admin, access granted.');
            return true;
          } else {
            console.warn('AdminGuard: User is not admin or not logged in, access denied. Redirecting to dashboard.');
            return this.router.createUrlTree(['/app/dashboard']);
          }
        }
        return this.router.createUrlTree(['/login']);
      }),
      catchError(() => {
        console.error('AdminGuard: Error checking admin status. Redirecting to login.');
        return of(this.router.createUrlTree(['/login']));
      })
    );
  }
}
