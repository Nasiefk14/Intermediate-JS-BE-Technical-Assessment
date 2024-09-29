import { Response } from "express";
import { Success } from "./SuccessHandlerUtil";

export class ResponseHandler {
  constructor(private res: Response) {}

  send(success: Success) {
    this.res.status(success.status).json(success);
  }
}
