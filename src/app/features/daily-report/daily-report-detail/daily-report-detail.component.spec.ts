import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailyReportDetailComponent } from './daily-report-detail.component';

describe('DailyReportDetailComponent', () => {
  let component: DailyReportDetailComponent;
  let fixture: ComponentFixture<DailyReportDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DailyReportDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DailyReportDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
