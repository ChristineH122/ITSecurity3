import { Component, OnInit, Input, ViewChild, AfterViewInit } from '@angular/core';
import { DeviceService } from '../services/device.service';
import { Device } from '../classes/Device';
import { MatSort, MatTableDataSource } from '@angular/material';

@Component({
  selector: 'app-devices',
  templateUrl: './devices.component.html',
  styleUrls: ['./devices.component.scss']
})
export class DevicesComponent implements OnInit {

  constructor(private deviceService: DeviceService) {
    this.ngOnInit.bind(this);
    this.columnNames = ['name', 'actual', 'set'];
  }

  @ViewChild(MatSort) sort: MatSort;

  @Input()
  public devices: MatTableDataSource<Device>;

  @Input()
  public columnNames: string[];

  async ngOnInit() {
    const data = await this.deviceService.getDevices();
    this.devices = new MatTableDataSource(data);
    this.devices.sort = this.sort;
  }
}
