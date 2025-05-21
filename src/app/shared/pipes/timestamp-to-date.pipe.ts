import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timestampToDate',
  standalone: true
})
export class TimestampToDatePipe implements PipeTransform {

  transform(value: unknown): Date | string | null {
    if (!value) return null;
    const v = value as Record<string, unknown>;
    if (typeof v === 'object' && v !== null && typeof v['toDate'] === 'function') {
      return (v['toDate'] as () => Date)();
    }
    return value as Date | string;
  }

}
