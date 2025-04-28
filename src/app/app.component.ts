import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TodoListComponent } from './todos/todo-list/todo-list.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TodoListComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'taskapp';

  environment = EnvironmentName.Prod;
  
}

enum EnvironmentName {
  Dev = 'dev',
  Test = 'test',
  Prod = 'prod'


}
