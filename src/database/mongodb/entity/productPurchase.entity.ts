import { model, Schema } from "mongoose";

export const ProductPurchaseSchema = new Schema({
  idRequest: String,
  codiceFiscale: String,
  dateOfRequest: String,
  investigation_record_id: String,
  productPurchaseResponse: Object,
  originalBody:Object,
  request_id: String
}, { timestamps: true });

export interface IProductPurchaseEntity {
  idRequest: string;
  codiceFiscale: string;
  dateOfRequest: string;
  investigation_record_id: string;
  productPurchaseResponse: Object;
  originalBody:any;
  request_id: string;
}

export const ProductPurchaseModel = model<IProductPurchaseEntity>('productPurchase', ProductPurchaseSchema);
