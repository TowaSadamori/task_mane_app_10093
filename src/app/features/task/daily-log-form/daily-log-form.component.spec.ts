import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailyLogFormComponent } from './daily-log-form.component';

describe('DailyLogFormComponent', () => {
  let component: DailyLogFormComponent;
  let fixture: ComponentFixture<DailyLogFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DailyLogFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DailyLogFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
