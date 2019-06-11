import { Component, OnInit, Input } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent implements OnInit {

  constructor(private _authService: AuthService) {
    this.amount = 0;
    this.showLogin = !_authService.isLoggedIn();

  }

  public showAmount: boolean;

  public amount: Number;

  public showLogin: boolean;

  public showAdmin: boolean;

  public logout() {
    this._authService.logout();
  }

  async ngOnInit() {
    this._authService.loggedIn.subscribe(async loggedIn => {
      this.showLogin = !loggedIn;
      this.showAdmin = await this._authService.isAdmin();
    });
    this.showAdmin = await this._authService.isAdmin();
  }
}
