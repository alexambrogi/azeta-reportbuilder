import mongoose from "mongoose";
import { ExecutionJobStatus, ExecutionJobModel, ErrorModel } from "../database/mongodb/entity/execution.entity";
import moment from "moment";

export class ExecutionJob {
    private id! : string;
    //private stage! : string;

    constructor(/*options? : { stage : string }*/) {
        this.id = new mongoose.Types.ObjectId().toString();
        //this.stage = (options || {} ).stage || 'LOCAL';
    }

    async start() {
        await ExecutionJobModel.findOneAndUpdate(
            { _id: this.id },
            { $set: { 
                  status: ExecutionJobStatus[ExecutionJobStatus.START],
                  startAt : moment().format('DD-MM-YYYY HH:mm:ss')
              }
            },
            { upsert: true }
          ).exec();
    }

    async complete() {
        await ExecutionJobModel.findOneAndUpdate(
            { _id: this.id },
            { $set: { 
                  status: ExecutionJobStatus[ExecutionJobStatus.COMPLETE],
                  endAt : moment().format('DD-MM-YYYY HH:mm:ss')
              }
            },
            { upsert: true }
          ).exec();
    }

    async error(message : string) {
        await ErrorModel.findOneAndUpdate(
            { _id: this.id },
            { $set: { 
                  status: ExecutionJobStatus[ExecutionJobStatus.ERROR],
                  message,
                  errorDate : moment().format('DD-MM-YYYY HH:mm:ss')
              }
            },
            { upsert: true }
          ).exec();
    }
}