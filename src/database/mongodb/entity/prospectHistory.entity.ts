import { model, Schema } from "mongoose";

export const ProspectHistorySchema = new Schema({
  idRequest: String,
  codiceFiscale: String,
  dateOfRequest: String,
  investigation_record_id: String,
  prospectHistoryResponse: Object,
  originalBody:Object,
  request_id: String,
}, { timestamps: true });

export interface IProspectHistoryEntity {
  idRequest: string;
  codiceFiscale: string;
  dateOfRequest: string;
  investigation_record_id: string;
  prospectHistoryResponse: Object;
  originalBody:any;
  request_id: string;
}

export const ProspectHistoryModel = model<IProspectHistoryEntity>('prospectHistory', ProspectHistorySchema);