import { Component, input, signal } from '@angular/core';

@Component({
  selector: 'app-todo-list-item',
  standalone: true,
  imports: [],
  templateUrl: './todo-list-item.component.html',
  styleUrl: './todo-list-item.component.scss'
})
export class TodoListItemComponent {
  // title: string = "Title Default Value";

  title = input.required<string>();

  isComplete = signal<boolean>(false);

  buttonDisabled = this.isComplete();


  toggleComplete() {
    this.isComplete.update((currentValue) => !currentValue);
  }

  isButtonDisabled(): boolean {
    return this.isComplete();

  }

}
