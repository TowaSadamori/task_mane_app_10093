import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PdfExportComponent } from './pdf-export.component';

describe('PdfExportComponent', () => {
  let component: PdfExportComponent;
  let fixture: ComponentFixture<PdfExportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfExportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PdfExportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
