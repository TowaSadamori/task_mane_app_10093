import { 
  Component, 
  OnInit, 
  inject, 
//  Input, 
  Inject
 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { 
  TaskService,
  // Task,
  DailyLog,
  NewDailyLogData,
} from '../../../core/task.service';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Timestamp } from '@angular/fire/firestore';

export interface DailyLogData {
  taskId: string;
  initialData?: DailyLog | null;
}

@Component({
  selector: 'app-daily-log-form',
  standalone: true,
  imports:[
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    // MatDialogModule,
  ],
  templateUrl:'./daily-log-form.component.html',
  styleUrls: ['./daily-log-form.component.scss'],
})

export class DailyLogFormComponent implements OnInit {
  dailyLogForm!: FormGroup;
  formError: string | null = null;
  isLoading = false;

  private taskService = inject(TaskService);
  private taskId!: string;
  private initialData: DailyLog | null = null;
  isEditMode = false;

  // @Input() taskId!: string;

  constructor(
    private dialogRef: MatDialogRef<DailyLogFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DailyLogData
  ) { 
    if(data?.taskId) {
      this.taskId = data.taskId;
    }
    if(data?.initialData) {
      this.initialData = data.initialData;
      this.isEditMode = true;
    }
  }

  ngOnInit(): void {
    this.dailyLogForm = new FormGroup({
      'workDate': new FormControl<Timestamp | null>(null, [Validators.required]),
      'actualStartTime': new FormControl('', [Validators.required]),
      'actualEndTime': new FormControl('', [Validators.required]),
      'actualBreakTime': new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
      'progressRate': new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
      'workerCount': new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
      'supervisor': new FormControl('', [Validators.required]),
      'comment': new FormControl(''),
    });

    if(this.isEditMode && this.initialData) {
      const formData = {
        ...this.initialData,
        workDate: this.initialData.workDate?.toDate() ?? null,
        actualStartTime: this.timestampToTimeString(this.initialData.actualStartTime),
        actualEndTime: this.timestampToTimeString(this.initialData.actualEndTime),
      }

      this.dailyLogForm.patchValue(formData);
      console.log('編集モード: フォームに初期値を設定しました', formData);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.dailyLogForm.invalid || !this.taskId) {
      this.dailyLogForm.markAllAsTouched();
      console.error('Form is invalid or taskId is missing');
      this.formError = '入力内容に誤りがあるか、タスクIDが指定されていません。';
      return;
    }

    this.isLoading = true;
    this.formError = null;

    const formValue = this.dailyLogForm.value;
    const logData : NewDailyLogData = {
      workDate: Timestamp.fromDate(formValue.workDate),
      reporterId: 'TODO: Get current user ID',
      actualStartTime: formValue.actualStartTime ? this.timeStringToTimestamp(formValue.workDate, formValue.actualStartTime) : null,
      actualEndTime: formValue.actualEndTime ? this.timeStringToTimestamp(formValue.workDate, formValue.actualEndTime) : null,
      actualBreakTime: formValue.actualBreakTime,
      progressRate: formValue.progressRate,
      workerCount: formValue.workerCount,
      supervisor: formValue.supervisor,
      comment: formValue.comment,
      plannedStartTime: this.initialData?.plannedStartTime ?? null,
      plannedEndTime: this.initialData?.plannedEndTime ?? null,
      plannedBreakTime: this.initialData?.plannedBreakTime ?? null,
      photos: this.initialData?.photos ?? null
    };

    try { 
      if(this.isEditMode && this.initialData?.id) {
        await this.taskService.updateDailyLog(this.taskId, this.initialData.id, logData);
        console.log('日次ログ更新成功: Log ID:', this.initialData.id);
        this.dialogRef.close('saved');
      } else {
        const docRef = await this.taskService.addDailyLog(this.taskId, logData);
        console.log('日次ログ保存成功: Document written with ID:', docRef.id);
        this.dialogRef.close('created');
      }

    } catch (error: unknown) {
      console.error('日次ログ保存失敗: ', error);
      let errorMessage = '日次ログの保存/更新に失敗しました。時間をおいて再度お試しください。';
      if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
        errorMessage = error.message;
      }
      this.formError = errorMessage;
    }finally {
      this.isLoading = false;
    }
  }

    private timeStringToTimestamp(workDate: Date, timeString: string): Timestamp | null {
      if(!timeString || !timeString.includes(':')) {
        console.error('不正確な時刻フォーマットです:', timeString);
        return null;
      }
      try {
        const [hours, minutes] = timeString.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59 ){
          console.error('時刻の数値が無効です:', hours, minutes);
          return null;
        }
        const dateWithTime = new Date(workDate);
        dateWithTime.setHours(hours, minutes, 0, 0);
        return Timestamp.fromDate(dateWithTime);
      } catch (error) {
        console.error('時刻からTimestampへの変換中にエラー:', error);
        return null;
      }
    }

    private timestampToTimeString(timestamp: Timestamp | null | undefined): string {
      if (!timestamp) {
        return '';
      }
      try {
        const date = timestamp.toDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      } catch (error) {
        console.error('Timestampから時刻文字列へ変換中にエラー:', error);
        return '';
      }
    }

    // onCancelClick(): void{
    //   this.dialogRef.close();
    // }

    // console.log('Daily Log Form Submitted!', this.dailyLogForm.value);
  }


