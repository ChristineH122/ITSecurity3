import * as express from "express";
import * as path from "path";
import Store, { ITokenContent } from "./store";
import logger from "./logger";
import { Device } from "./entity/Device";
import { AdvancedConsoleLogger } from "typeorm";

/* tslint: disable */
const bodyParser = require("body-parser");
const fs = require('fs');
const expressBrute = require('express-brute');
/* tslint: enable */ 

const allowedExt = [
  ".js",
  ".ico",
  ".css",
  ".png",
  ".jpg",
  ".woff2",
  ".woff",
  ".ttf",
  ".svg",
];

export class Server {
  public app: express.Application;

  //bruteforce protection - according to https://www.npmjs.com/package/express-brute
  private bruteforce: any;

  constructor(private store: Store) {
    //Setup
    this.store.connectDb();
    this.app = express();
    this.app.use(bodyParser.json());
    this.bruteforce = new expressBrute(new expressBrute.MemoryStore(), {
      freeRetries: 3,
      minWait: 1*60*1000, // 1 minute
      maxWait: 60*60*1000, // 1 hour,
      failCallback: this.bruteforceDetected.bind(this),
    });
  

    // Middleware
    //this.app.use(this.logRequest.bind(this));
    //Publicly accessible routes
    this.app.post("/api/login", this.bruteforce.prevent, this.loginUser.bind(this));
    this.app.post("/api/register",this.registerUser.bind(this));
    this.app.post("/api/security", this.setSecureMode.bind(this));
    this.app.put("/api/update/devices",this.updateDevices.bind(this));
    this.app.get("/api/devices", this.getDevices.bind(this));
    this.app.get("/api/actions", this.getActions.bind(this));
    this.app.get("/api/access", this.isSessionIdAdmin.bind(this));
    this.app.get("/api/security", this.getSecureMode.bind(this));
    this.app.get("*",this.webContent.bind(this));
    //Port
    this.app.listen(4000);
    // Bindings
    this.log.bind(this);
  }

  private async bruteforceDetected(req: express.Request, res: express.Response, next: express.NextFunction, nextValidRequestDate: any) {
    //bruteforce detected!
    if (this.store.secureMode) {
      res.status(429).send();
    } else {
      this.bruteforce.reset(req.ip, null, null);
      next();
    }
  }

  private logRequest(req: express.Request, res: express.Response,next: express.NextFunction) {
    this.log(`(${req.method}) ${req.url}`);
    next();
  }

    // Source: https://blog.cloudboost.io/run-your-angular-app-on-nodejs-c89f1e99ddd3
  private webContent(req: express.Request, res: express.Response) {
    if (allowedExt.filter((ext: string) => req.url.indexOf(ext) > 0).length > 0) {
      res.sendFile(path.resolve(`../frontend/dist/smartep/${req.url}`));
    } else {
      res.sendFile(path.resolve("../frontend/dist/smartep/index.html"));
    }
  }

  public async getDevices(req: express.Request, res: express.Response) : Promise<void> {
    let uuid : string = await this.isAuthorized(req);
    if(uuid) {
      let devices = await this.store.getDevices();
      res.status(200).send(devices);
    }
    else{
      res.status(401).send();
    }
  }

  public async getActions(req: express.Request, res: express.Response) : Promise<void> {
    let uuid : string = await this.isAdmin(req);
    if(uuid) {
      let actions = await this.store.getActions();
      res.status(200).send(actions);
    }
    else {
      res.status(401).send();
    }
  }

  public async updateDevices(req: express.Request, res: express.Response) : Promise<void> {
    let uuid : string = await this.isAdmin(req);
    let devices : Device[] = req.body.devices ? req.body.devices : null;

    if(! devices) {
      res.status(400).send();
    }

    if(uuid) {
        let result : boolean = await this.store.updateDevices(devices,uuid);
        if (result) res.status(200).send();
        else res.status(400).send();
    }
    else {
      res.status(401).send();
    }
  }

  private async loginUser(req: express.Request, res: express.Response) {
    let name: string = req.body.name ? req.body.name : null;
    let keyword: string = req.body.keyword ? req.body.keyword : null;
    if (await this.store.validateUserCredentials(name, keyword)) {
      let uuid = await this.store.getUserUuid(name);
      let token = await this.store.createToken(uuid);

      res.status(200).send(JSON.stringify(token));
      this.bruteforce.reset(req.ip, null, null);
    } else {
      res.status(401).send();
    }
  }

  private async registerUser(req: express.Request, res: express.Response) {
    let name: string = req.body.name ? req.body.name : null;
    let keyword: string = req.body.keyword ? req.body.keyword : null;
    let createUser: boolean = true;

    if (this.store.secureMode) {
      if (!this.isSecurePassword(name, keyword)) {
        createUser = false;
      }
    }

    if(name && keyword && createUser) {
      let result = await this.store.createUser(name,keyword);
      if(result) {
        res.status(200).send();
      }
      else res.status(409).send();
    }
    else {
      res.status(400).send();
    }
  }

  private async isSecurePassword(username: string, password: string) {
    if (username == password) {
      return false;
    }

    if (password.length < 10) {
      return false;
    }

    try {
      const data = fs.readFileSync('wordlist.txt');
      if (data.indexOf(password) >= 0) {
        return false;
      } else {
        return true;
      }
    } catch {
      return true;
    }
  }

  private async isAuthorized(request: express.Request): Promise<string> {
    let token = request.headers.authorization ? request.headers.authorization : null;
    if (!token) {
       return new Promise((resolve,_) => { resolve(null) });
    }

    let tokenContent : ITokenContent = this.store.decode(token);
    let exists: boolean = await this.store.exists(tokenContent.uuid);

    return exists ? tokenContent.uuid : null ;
  }

  private async isAdmin(request: express.Request): Promise<string> {
    let token = request.headers.authorization ? request.headers.authorization : null;
    if (! token ) return new Promise((resolve,_) => {resolve(null)});

    let tokenContent : ITokenContent = this.store.decode(token);
    let exists : boolean = await this.store.exists(tokenContent.uuid);
    let isAdmin : boolean = await this.store.isAdminFromID(tokenContent.uuid);
    return exists && isAdmin ? tokenContent.uuid : null;
  }

  private log(message: string) : void {
    logger.info(message);
    this.store.logMessage(message);
  }

  private async isSessionIdAdmin(request: express.Request, response: express.Response): Promise<void> {
    let token = request.headers.authorization ? request.headers.authorization : null;

    if (! token){
       response.status(200).send(JSON.stringify({isAdmin:false}));
    } else {
      let tokenContent : ITokenContent = this.store.decode(token);
      let isAdmin : boolean = await this.store.isAdminFromID(tokenContent.uuid);

      if (isAdmin) {
        response.status(200).send(JSON.stringify({isAdmin:true}));
      } else {
        response.status(200).send(JSON.stringify({isAdmin:false}));
      }
    }
  }

  private async getSecureMode(request: express.Request, response: express.Response): Promise<void> {
    let token = request.headers.authorization ? request.headers.authorization : null;

    if (! token) {
       response.status(401).send();
    } else {
      let tokenContent : ITokenContent = this.store.decode(token);
      let isAdmin : boolean = await this.store.isAdminFromID(tokenContent.uuid);

      if (isAdmin) {
        response.status(200).send(JSON.stringify({secureMode:this.store.secureMode}));
      } else {
        response.status(401).send();
      }
    }
  }

  private async setSecureMode(request: express.Request, response: express.Response): Promise<void> {
    let token = request.headers.authorization ? request.headers.authorization : null;

    if (!token) {
       response.status(401).send();
    } else {
      let tokenContent : ITokenContent = this.store.decode(token);
      let isAdmin : boolean = await this.store.isAdminFromID(tokenContent.uuid);
      let resSent = false;

      if (isAdmin) {
        if (request.body.status !== undefined) {
          if (request.body.status === true) {
            this.store.secureMode = true;
            response.status(200).send();
            resSent = true;
          } else {
            if (request.body.status === false) {
              this.store.secureMode = false;
              response.status(200).send();
              resSent = true;
            }
          }
          if (!resSent) {
            response.status(400).send();
          }
          
        } else {
          response.status(400).send();
        }
      } else {
        response.status(401).send();
      }
    }
  }
}
new Server(new Store());