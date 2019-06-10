import { Injectable } from '@angular/core';
import {AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SecurityService {

  constructor(public auth: AuthService) { }

  public async isSecureStatusOn(): Promise<boolean> {
    console.log("in is secure status")
    const token = this.auth.getToken();
    if (token) {
      const answer = await fetch(`${location.origin}/api/security`, {
      method: 'GET',
      headers: {
        // 'Accept': 'application/json',
        // 'Content-Type': 'application/json',
        'Authorization': this.auth.getToken()
      }
      // body: JSON.stringify({ name: name, keyword: phrase })
    }).then(res => { if (res.ok) {
      return res.json();
    } else {
      return null;
    }}).then(data => {
      if (data && (data.secureMode !== undefined) && (data.secureMode !== null)) {
        console.log(data.secureMode);
        return data.secureMode;
      } else {
        return null;
      }
    });
    return answer;
  } else {
    return null;
  }
  }

  public async setSecureStatus(status: boolean): Promise<boolean> {
    const response = await fetch(`${location.origin}/api/security`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': this.auth.getToken(),
      },
      body: JSON.stringify({ status : status })
    });
    if (response.status === 200) {
      return true;
    } else {
      return false;
    }
  }
}
