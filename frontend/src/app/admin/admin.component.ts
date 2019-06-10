import { Component, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { SecurityService } from '../services/security.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {

  constructor(private auth: AuthService, private sec: SecurityService) {
  }

  securityState: boolean;

  async ngOnInit() {
    this.sec.isSecureStatusOn().then(state => {
    if (state !== null) {
      console.log("in ng on init security is " + state);
      this.securityState = state;
    } else {
      window.alert('There has been a problem with server communication!');
    }});
  }


  changeState() {
    if (this.sec.setSecureStatus(!this.securityState)) {
      this.securityState = !this.securityState;
    } else {
      window.alert('There has been a problem with server communication!');
    }
  }

}
