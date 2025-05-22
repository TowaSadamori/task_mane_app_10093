import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddWeeklyReportDialogComponent } from './add-weekly-report-dialog.component';

describe('AddWeeklyReportDialogComponent', () => {
  let component: AddWeeklyReportDialogComponent;
  let fixture: ComponentFixture<AddWeeklyReportDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddWeeklyReportDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddWeeklyReportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
