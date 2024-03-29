import { Injectable, EventEmitter } from '@angular/core';
import decode from 'jwt-decode';
import { JwtHelperService } from '@auth0/angular-jwt';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private jwtHelper: JwtHelperService) {}

  public loggedIn: EventEmitter<boolean> = new EventEmitter<boolean>();

  public async register(name: string, phrase: string): Promise<boolean> {
    const response = await fetch(`${location.origin}/api/register`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': this.getToken()
      },
      body: JSON.stringify({ name: name, keyword: phrase })
    });

    if (response.status === 200) {
      return true;
    } else {
      return false;
    }
  }

  public async login(name: string, word: string): Promise<boolean> {
    const token = this.jwtHelper.tokenGetter();

    if (token && !this.jwtHelper.isTokenExpired(token)) {
      return Promise.resolve(false);
    }

    const response = await fetch(`${location.origin}/api/login`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ name: name, keyword: word })
    });
    if (response.status === 200) {
      const data = await response.json();
      localStorage.setItem('token', data);
      this.loggedIn.emit(true);
      return true;
    } else {
      if (response.status === 429) {
        alert('Too many attempts in a short time. You will have to wait some minutes to try again.');
      } else {
        alert('Wrong username or password!');
      }
      return false;
    }
  }

  public logout() {
    localStorage.removeItem('token');
    this.loggedIn.emit(false);
  }

  public isLoggedIn(): boolean {
    const token: string = localStorage.getItem('token');

    if (token) {
      return !this.jwtHelper.isTokenExpired(token);
    } else {
      return false;
    }
  }

  public getToken(): string {
    return localStorage.getItem('token');
  }

  public getRole(): string {
    if (this.isAdmin) {
      return 'admin';
    }

    return null;
  }

  public async isAdmin(): Promise<boolean> {
    const token = this.getToken();
    if (token) {
      return fetch(`${location.origin}/api/access`, {
        method: 'GET',
        headers: {
          'Authorization': this.getToken()
        }
      }).then(res => { if (res.ok) {
        return res.json();
      } else {
        return false;
      }}).then(data => {
        if (data && data.isAdmin) {
          return data.isAdmin;
        } else {
          return false;
        }
      });
    } else {
      return false;
    }
  }
}
