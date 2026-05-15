import { model, Schema } from "mongoose";

export const MainDocumentSchema = new Schema({
    idRequest: String,
    codiceFiscale: String,
    dateOfRequest: String,
    investigation_record_id: String,
    mainDocumentResponse: Object,
    originalBodyProduct:Object,
    originalBody : Object,
    id_request_Product : String,
    id_request_Main : String,
  });

  export interface IMainDocumentEntity {
    idRequest : string;
    codiceFiscale : string;
    dateOfRequest : string;
    investigation_record_id : string;
    mainDocumentResponse : Object; 
    originalBodyProduct:any,
    originalBody : any;
    id_request_Product : string;
    id_request_Main : string;
}

export const MainDocumentModel = model<IMainDocumentEntity>('mainDocument', MainDocumentSchema);