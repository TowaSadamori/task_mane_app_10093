import { Injectable } from '@angular/core';
import { 
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';

import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from './auth.service';


@Injectable({
  providedIn: 'root'
})

export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ){}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ):Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {

    return this.authService.authState$.pipe(
      take(1),
      map(user => {
        if (user) {
          return true;
        } else {
          console.log('AuthGuard: User not logged in, redirecting to login.');

          return this.router.createUrlTree(['/login']);
        }
      })
    );
  }
}


