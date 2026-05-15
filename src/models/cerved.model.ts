export interface ICervedBodyProductPurchase {
    format: string;
    product_id: number;
    subject_type: string;
    vat_number?: string;
    tax_code?: string;
    language: string;
}

export interface ICervedBodyProspectHistory {
    request_id: string | number;
    language: string;
    format: string;
    accessory_document_type: string;
}

export interface ICervedResponse {
    request_id: string;
    delivery_status: string;
    content: string;
    format: string;
}

export interface ICervedResponseProspectHistory extends ICervedResponse {
    detailed_delivery_status: string;
}

export interface IGetRequestFromJsonOptions {
    format?: boolean | string;
    request_id?: string;
}

export interface IBodyTemplateJson<T> extends IGetRequestFromJsonOptions {
    json: T
}