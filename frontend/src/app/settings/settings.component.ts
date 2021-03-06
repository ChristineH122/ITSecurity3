import { Component, OnInit, Input, ViewChild, AfterViewInit } from '@angular/core';
import { DeviceService } from '../services/device.service';
import { Device } from '../classes/Device';
import { MatSort, MatTableDataSource } from '@angular/material';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {

  constructor(private deviceService: DeviceService) {

    this.ngOnInit.bind(this);
    this.columnNames = ['name', 'actual', 'set'];
  }

  @ViewChild(MatSort) sort: MatSort;

  @Input()
  public devices: MatTableDataSource<Device>;

  @Input()
  public columnNames: string[];

  @Input()
  public msg: string;

  @Input()
  public success: boolean;

  async ngOnInit() {
    const data = await this.deviceService.getDevices();
    this.devices = new MatTableDataSource(data);
    this.devices.sort = this.sort;
  }

  public async save(): Promise<void> {
    const result = await this.deviceService.updateDevices(this.devices.data);
    if (! result) {
      this.msg = 'Unable to save changes!'; this.success = false;
    } else {
      this.msg = 'Successfully saved changes!';  this.success = true;
    }
  }
}
