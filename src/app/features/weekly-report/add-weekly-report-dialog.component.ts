import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { UserService } from '../../core/user.service';
import { AuthService } from '../../core/auth.service';
import { User } from '../../core/models/user.model';
import { Firestore, collection, addDoc, Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-add-weekly-report-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatDatepickerModule, MatButtonModule, MatNativeDateModule, MatRadioModule, MatIconModule, MatSelectModule, MatOptionModule
  ],
  styleUrls: ['./add-weekly-report-dialog.component.scss'],
  templateUrl: './add-weekly-report-dialog.component.html',
})
export class AddWeeklyReportDialogComponent {
  form = new FormGroup({
    periodStart: new FormControl<Date | null>(null, Validators.required),
    periodEnd: new FormControl<Date | null>(null, Validators.required),
    person: new FormControl({ value: '', disabled: true }, Validators.required),
    manager: new FormControl<string[]>([], Validators.required),
    hasReport: new FormControl('no', Validators.required),
    hasAccident: new FormControl('no', Validators.required),
    hasHealthIssue: new FormControl('no', Validators.required),
    memo: new FormControl(''),
  }, AddWeeklyReportDialogComponent.periodRangeValidator);
  selectedPhotos: File[] = [];
  users: User[] = [];
  constructor(
    private dialogRef: MatDialogRef<AddWeeklyReportDialogComponent>,
    private userService: UserService,
    private authService: AuthService,
    private firestore: Firestore
  ) {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
    });
    this.setCurrentUserAsPerson();
  }
  async setCurrentUserAsPerson() {
    const user = await this.authService.getCurrentUser();
    if (user && user.displayName) {
      this.form.get('person')?.setValue(user.displayName);
    }
  }
  onCancel() { this.dialogRef.close(); }
  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedPhotos = input.files ? Array.from(input.files) : [];
  }
  async onSubmit() {
    if (this.form.valid) {
      const value: Record<string, unknown> = { ...this.form.getRawValue(), photos: this.selectedPhotos };
      const col = collection(this.firestore, 'weeklyReports');
      if (value['periodStart'] instanceof Date) value['periodStart'] = Timestamp.fromDate(value['periodStart'] as Date);
      if (value['periodEnd'] instanceof Date) value['periodEnd'] = Timestamp.fromDate(value['periodEnd'] as Date);
      value['createdAt'] = Timestamp.now();
      await addDoc(col, value);
      this.dialogRef.close(value);
    }
  }
  removePhoto(i: number) {
    this.selectedPhotos.splice(i, 1);
  }

  // 期間バリデーション: 開始日<=終了日、かつ最大7日間
  static periodRangeValidator(control: import('@angular/forms').AbstractControl) {
    const group = control as FormGroup;
    const start = group.get('periodStart')?.value;
    const end = group.get('periodEnd')?.value;
    if (!start || !end) return null;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (startDate > endDate) {
      return { periodOrder: true };
    }
    if (diff > 6) {
      return { periodMax: true };
    }
    return null;
  }
}
