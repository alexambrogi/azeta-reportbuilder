import { model, Schema } from "mongoose";

export const BaseJointOwnerSchema = new Schema({
    codiceFiscale: String,
    data: Object,
    type: String,
    request_id : String,
    originalBody : Object,
}, { timestamps: true });

export interface BaseJointOwnerEntity {
    codiceFiscale: string;
    data: Object;
    type: string;
    request_id : any;
    originalBody : any;
}

export const BaseJointOwnerModel = model<BaseJointOwnerEntity>('baseJointOwner', BaseJointOwnerSchema);
