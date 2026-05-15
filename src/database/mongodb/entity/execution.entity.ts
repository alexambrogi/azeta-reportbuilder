import { Schema, model } from "mongoose";

export enum ExecutionJobStatus {
    START,
    ERROR,
    COMPLETE
}

export const ExecutionJobSchema = new Schema({
  status: {
    type: String,
    enum: [
      ExecutionJobStatus[ExecutionJobStatus.START],
      ExecutionJobStatus[ExecutionJobStatus.ERROR],
      ExecutionJobStatus[ExecutionJobStatus.COMPLETE],
    ],
  },
  startAt: String,
  message: { type: String, required: false },
  endAt: String,
  expireAt: { type: Date, expires: parseInt(process.env.MONGODB_TTL as string) },
});

export const ErrorSchema = new Schema({
  message: { type: String, required: true },
  errorDate: String,
  expireAt: { type: Date, expires: parseInt(process.env.MONGODB_TTL as string) },
});

export interface IExecutionJobEntity {
    _id : string;
    status : string;
    message? : string;
    startAt : string;
    endAt : string;
    expireAt : Date;
}

export interface IErrorEntity {
  _id : string;
  status : string;
  message? : string;
  expireAt : Date;
}


export const ExecutionJobModel = model<IExecutionJobEntity>('executions', ExecutionJobSchema);
export const ErrorModel = model<IErrorEntity>('errors', ErrorSchema);