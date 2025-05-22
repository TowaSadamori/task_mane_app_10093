import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddMonthlyReportDialogComponent } from './add-monthly-report-dialog.component';

describe('AddMonthlyReportDialogComponent', () => {
  let component: AddMonthlyReportDialogComponent;
  let fixture: ComponentFixture<AddMonthlyReportDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddMonthlyReportDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddMonthlyReportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
