import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component'; 
import { AuthGuard } from './core/auth.guard';
import { AppLayoutComponent } from './layout/app-layout/app-layout.component'; 
// import { UserCreateComponent } from './features/admin/components/user-create/user-create.component';

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
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'tasks',
        loadComponent: () => import('./features/task/task-list/task-list.component').then(m => m.TaskListComponent)
      },
      {
        path: 'tasks/:taskId',
        loadComponent: () => import('./features/task/task-detail/task-detail.component').then(m => m.TaskDetailComponent)
      }
    ]
  },
  // {
  //   path: 'admin-create-test',
  //   component: UserCreateComponent
  // },
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