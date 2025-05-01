import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component'; 
import { AuthGuard } from './core/auth.guard';
import { AppLayoutComponent } from './layout/app-layout/app-layout.component'; 

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'app',
    component: AppLayoutComponent, 
    canActivate: [AuthGuard],  
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }, 
    ]
  },
  {
    path: '',
    redirectTo: '/app', 
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/app' 
  }
];