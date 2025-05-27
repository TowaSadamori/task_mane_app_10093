import { Component, Inject } from '@angular/core';
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
import { Firestore, collection, addDoc, Timestamp, doc, updateDoc } from '@angular/fire/firestore';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { getStorage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';

@Component({
  selector: 'app-add-monthly-report-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatDatepickerModule, MatButtonModule, MatNativeDateModule, MatRadioModule, MatIconModule, MatSelectModule, MatOptionModule
  ],
  styleUrls: ['./add-monthly-report-dialog.component.scss'],
  templateUrl: './add-monthly-report-dialog.component.html',
})
export class AddMonthlyReportDialogComponent {
  form = new FormGroup({
    periodStart: new FormControl<Date | null>(null, Validators.required),
    periodEnd: new FormControl<Date | null>(null, Validators.required),
    person: new FormControl('', Validators.required),
    manager: new FormControl<string[]>([], Validators.required),
    hasReport: new FormControl('no', Validators.required),
    hasAccident: new FormControl('no', Validators.required),
    hasHealthIssue: new FormControl('no', Validators.required),
    memo: new FormControl(''),
  }, AddMonthlyReportDialogComponent.periodRangeValidator);
  selectedPhotos: File[] = [];
  users: User[] = [];
  existingPhotoUrls: string[] = [];
  constructor(
    private dialogRef: MatDialogRef<AddMonthlyReportDialogComponent>,
    private userService: UserService,
    private authService: AuthService,
    private firestore: Firestore,
    @Inject(MAT_DIALOG_DATA) public data?: Record<string, unknown>
  ) {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
    });
    this.setCurrentUserAsPerson();
    if (data) {
      this.patchFormWithData(data);
    }
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
      const value: Record<string, unknown> = { ...this.form.value };
      // 日付変換
      if (value['periodStart'] instanceof Date) value['periodStart'] = Timestamp.fromDate(value['periodStart'] as Date);
      if (value['periodEnd'] instanceof Date) value['periodEnd'] = Timestamp.fromDate(value['periodEnd'] as Date);
      value['createdAt'] = Timestamp.now();

      // 既存画像URLをセット
      const photoUrls = [...this.existingPhotoUrls];
      // 写真アップロード
      const storage = getStorage();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const file of this.selectedPhotos) {
        const storageRef = ref(storage, `monthlyReports/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        photoUrls.push(url);
      }
      value['photoUrls'] = photoUrls;

      if (this.data && this.data['id']) {
        // 更新
        const refDoc = doc(this.firestore, 'monthlyReports', this.data['id'] as string);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateDoc(refDoc, value as any);
        this.dialogRef.close({ ...value, id: this.data['id'] });
      } else {
        // 新規作成
        const col = collection(this.firestore, 'monthlyReports');
        await addDoc(col, value);
        this.dialogRef.close(value);
      }
    }
  }
  removePhoto(i: number) {
    this.selectedPhotos.splice(i, 1);
  }
  removeExistingPhoto(i: number) {
    this.existingPhotoUrls.splice(i, 1);
  }

  // 期間バリデーション: 開始日<=終了日、かつ最大31日間
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
    if (diff > 30) {
      return { periodMax: true };
    }
    return null;
  }

  patchFormWithData(data: Record<string, unknown>) {
    // 日付型や配列型の変換も考慮
    const patch: Record<string, unknown> = { ...data };
    if (patch['periodStart'] && typeof patch['periodStart'] === 'object' && 'toDate' in patch['periodStart'] && typeof (patch['periodStart'] as { toDate: () => Date }).toDate === 'function') {
      patch['periodStart'] = (patch['periodStart'] as { toDate: () => Date }).toDate();
    }
    if (patch['periodEnd'] && typeof patch['periodEnd'] === 'object' && 'toDate' in patch['periodEnd'] && typeof (patch['periodEnd'] as { toDate: () => Date }).toDate === 'function') {
      patch['periodEnd'] = (patch['periodEnd'] as { toDate: () => Date }).toDate();
    }
    // personフィールドが存在する場合はセット
    if (patch['person']) {
      this.form.get('person')?.setValue(patch['person'] as string);
    }
    // 既存画像URLをセット
    if (patch['photoUrls'] && Array.isArray(patch['photoUrls'])) {
      this.existingPhotoUrls = patch['photoUrls'] as string[];
    }
    this.form.patchValue(patch);
  }
}
