import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'statusLabel',
  standalone: true,
})
export class StatusLabelPipe implements PipeTransform {
  transform(value: string): string {
    switch (value) {
      case 'todo':
        return '未着手';
      case 'doing':
        return '進捗中';
      case 'done':
        return '完了';
      default:
        return value;
    }
  }
} 