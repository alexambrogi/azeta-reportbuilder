import { model, Schema } from "mongoose";

export const RealEstateDataBaseSchema = new Schema({
    codiceFiscale: String,
    data: Object,
    isEstimate: Boolean,
    originalBody : Object,
    request_id : String,
}, { timestamps: true });

export interface RealEstateDataBaseEntity {
    codiceFiscale: string;
    data: Object;
    isEstimate: boolean;
    originalBody : any;
    request_id : string;
}

export const RealEstateDataBaseModel = model<RealEstateDataBaseEntity>('realEstateDataBase', RealEstateDataBaseSchema);
