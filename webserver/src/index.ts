import * as express from "express";
import * as path from "path";
import Store, { ITokenContent } from "./store";
import logger from "./logger";
import { Device } from "./entity/Device";

/* tslint: disable */
const bodyParser = require("body-parser");
const fs = require('fs');
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

  constructor(private store: Store) {
    //Setup
    this.store.connectDb();
    this.app = express();
    this.app.use(bodyParser.json());
    // Middleware
    //this.app.use(this.logRequest.bind(this));
    //Publicly accessible routes
    this.app.post("/api/login", this.loginUser.bind(this));
    this.app.post("/api/register",this.registerUser.bind(this));
    this.app.put("/api/update/devices",this.updateDevices.bind(this));
    this.app.get("/api/devices", this.getDevices.bind(this));
    this.app.get("/api/actions", this.getActions.bind(this));
    this.app.get("/api/access", this.isSessionIdAdmin.bind(this));
    this.app.get("*",this.webContent.bind(this));
    //Port
    this.app.listen(4000);
    // Bindings
    this.log.bind(this);
  }

  // TODO: delete when app is completed
  private async test(): Promise<void> {
    let result = await this.store.connectDb();
    // let added = await this.store.createUser("admin","admin");
    // let added1 = await this.store.createUser("peter","peter");
    // let added2 = await this.store.createUser("kevin","kevin");
    // let added3 = await this.store.createUser("alex","alex");
    // console.log(`added: ${added}`);
    console.log(`Connected:  ${result}`);
  }

  private logRequest(req: express.Request, res: express.Response,next: express.NextFunction){
    this.log(`(${req.method}) ${req.url}`);
    next();
  }

    // Source: https://blog.cloudboost.io/run-your-angular-app-on-nodejs-c89f1e99ddd3
  private webContent(req: express.Request, res: express.Response) {
    if (
      allowedExt.filter((ext: string) => req.url.indexOf(ext) > 0).length > 0
    ) {
      res.sendFile(
        path.resolve(`../frontend/dist/smartep/${req.url}`),
      );
    } else {
      res.sendFile(
        path.resolve("../frontend/dist/smartep/index.html"),
      );
    }
  }

  public async getDevices(req: express.Request, res: express.Response) : Promise<void> {
    let uuid : string = await this.isAuthorized(req);
    console.log(uuid);
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
    else{
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
    if (await this.store.validateUserCredentials(name, keyword)
    ) {
      let uuid = await this.store.getUserUuid(name);
      //let userRole = await this.store.getUserRole(name); removed by Christine
      //let token = await this.store.createToken(userRole, uuid);
      let token = await this.store.createToken(uuid);

      res.status(200).send(JSON.stringify(token));
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

    if(name && keyword && createUser)
    {
      let result = await this.store.createUser(name,keyword);
      if(result) res.status(200).send();
      else res.status(409).send();
    }
    else{
      res.status(400).send();
    }
  }

  private isSecurePassword(username: string, password: string) {
    if (username == password) {
      return false;
    }

    if (password.length < 10) {
      return false;
    }

    fs.readFile('wordlist.txt', (err : any, data: any) => {
      if (err) {
        return true;
      } else {
        if (data.indexOf(password) >= 0) {
          return false;
        } else {
          return true;
        }
      }
    });
  }

  private async isAuthorized(request: express.Request): Promise<string> {
    let token = request.headers.authorization ? request.headers.authorization : null;
    console.log(token);
    if (! token ) {
       return new Promise((resolve,_) => { resolve(null) });
    }

    let tokenContent : ITokenContent = this.store.decode(token);
    console.log("exists question");
    let exists: boolean = await this.store.exists(tokenContent.uuid);
    console.log(exists);
    console.log("exists done");

    return exists ? tokenContent.uuid : null ;
  }

  // private async isAdmin(request: express.Request): Promise<string> {
  //   let token = request.headers.authorization ? request.headers.authorization : null;
  //   if (! token ) return new Promise((resolve,_) => {resolve(null)});

  //   let tokenContent : ITokenContent = this.store.decode(token);
  //   let exists : boolean = await this.store.exists(tokenContent.uuid);
  //   console.log(tokenContent);
  //   return exists && tokenContent.role === "admin" ? tokenContent.uuid : null;
  // }

    //added by Christine
    private async isAdmin(request: express.Request): Promise<string> {
    let token = request.headers.authorization ? request.headers.authorization : null;
    if (! token ) return new Promise((resolve,_) => {resolve(null)});

    let tokenContent : ITokenContent = this.store.decode(token);
    let exists : boolean = await this.store.exists(tokenContent.uuid);
    console.log(tokenContent);
    let isAdmin : boolean = await this.store.isAdminFromID(tokenContent.uuid);
    return exists && isAdmin ? tokenContent.uuid : null;
  }

  private log(message: string) : void {
    logger.info(message);
    this.store.logMessage(message);
  }

  private async isSessionIdAdmin(request: express.Request, response: express.Response): Promise<void> {
    console.log("in isSessionIdAdmin");
    let token = request.headers.authorization ? request.headers.authorization : null;

    if (! token){
       response.status(200).send(JSON.stringify({isAdmin:false}));
    } else {
      console.log("before is Admin");
      let tokenContent : ITokenContent = this.store.decode(token);
      let isAdmin : boolean = await this.store.isAdminFromID(tokenContent.uuid);
      console.log("after is Admin");

      if (isAdmin) {
        response.status(200).send(JSON.stringify({isAdmin:true}));
      } else {
        response.status(200).send(JSON.stringify({isAdmin:false}));
      }
    }


  }
}

new Server(new Store());