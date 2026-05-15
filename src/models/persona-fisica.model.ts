import { Buildings, descriptionProtest, Eredi, Pra } from "./persona-giuridica.model"

export interface ICribisPersonaFisica {
    nomeDocumento?: string, 
    informazioneN?:string,
    campaign_kind_id?: string,
    esito?: boolean,
    inputData?: {
        dateRequested: string,
        dateFulfillment: string,
        numberInformation: string,
        refCustomer: string
    }
    availability?: string[],
    isReperibilita?: boolean,
    contactPhoneNumber?: RecapitiTelefonici[],
    notePhoneNumber?: RecapitiTelefonici[],
    bankingRelationships: BankingRelationship[],
    vehicles: Pra[],
    recoverabilityJudgment?: boolean,
    negotiationInvestigations?: any[],
    registry: AnagraficaPersonaFisica,
    workingActivity: {
        pension: any[],
        activityJob: any[],
        freelancer: boolean
    },
    negativity: {
        protests: {
            flag: boolean,
            details?: {
                values: descriptionProtest[],
                count: number,
                lastest: string,
                totalAmout: string
            }
        },
        prejudicial: {
            value: boolean,
            prejudicials: Prejudicial[],
            details: {
                count: any,
                totalAmout: number | string,
                lastest: any,
                descriptions: {
                    descriptionPrejudical: any,
                    count: any,
                    totalAmoutEvent: number | string
                }[]
            }
        },
        insolvencyProceedings: boolean
    },
    companyShareholdings?: any,
    buildings?: Buildings,
    positionsInCompany?: {
        activePositions: any[],
        pastPositions: any[]
    }
    mortgageInsights?: string,
    inheritorsAccepting?: Eredi[],
    inheritorsCalled?: Eredi[],
    domicile?: Object,
}

export interface RecapitiTelefonici {
    fixed: boolean,
    contact: string
}

export interface Veicolo {
    type: string;
    registrationDate: string;
    plate: string;
    frameNumber: string;
    subjectRole: string;
    brand: string;
    model: string;
}

export interface BankingRelationship extends ContoCorrente {
    address: string
}

export interface ContoCorrente {
    address: string
    businessName: string,
    city: string,
    piva: string,
    abi: string,
    cab: string,
    toponimo: string,
    streetName: string,
    streetNumber: string,
    cap: string,
    province: string
}

export interface AnagraficaPersonaFisica {
    name: string,
    surname: string,
    cf: string,
    dateOfBirth: string | null,
    placeOfBirth: string | null,
    provinceOfBirth: string | null,
    address: string,
    cap: string,
    municipality: string,
    province: string,
    livingAddress: string,
    livingCap: string,
    livingMunicipality: string,
    livingProvince: string,
    nota?: string,
    isIrreperibile? : boolean
}

export interface Prejudicial {
    index: number,
    subjectVersus: string,
    taxCode: string,
    subjectBeneficiary: string,
    conservatory: string,
    actDate: string,
    genericNumber: string,
    specificNumber: string,
    actDescription: string
    actCode: string,
    amount: string,
    guarantedAmount: string
}