import { AnagraficaPersonaFisica, Prejudicial } from "./persona-fisica.model"

export interface ICribisPersonaGiuridica {
    isNoRea?: boolean
    esito?: any
    campaign_kind_id?: string,
    inputData?: {
        dateOfRequest: string,
        releaseDate: string,
        numberInformation: string,
        refCustomer: string
    },
    registry?: { //Anagrafica
        businessName: string,
        taxCode: string,
        iva: string,
        codeREA: string,
        site: string,
        legalForm: string,
        stateOfCompany: string,
        startCompanyDate: string,
        socialCapital?: string,
        activity: string,
        raeCode: string,
        saeCode: string,
        naceCode?: string,
        certifiedEmail: string,
        dateIncorporation: string,
        expectedEndDate?: string,
        section?: string
    },
    companyData?: {
        codiceFiscale?: string,
        cciaaNrea?: string,
        denominazione?: string,
        indirizzo?: string,
        telefono?: string,
        fax?: string,
        emailCertificata?: string,
        attivita?: string,
    }
    administration?: { //Sistema di amministrazione e controllo
        form: string,
        systemOfAdministration: string,
        administrationForm: string,
        numberOfAdministration: string
    },
    balance?: {
        referenceYears: string[],
        balanceDetails: BalanceDetail[]
    },
    members?: Members[],
    annualEmployees?: { //Soci
        workforce: { //valori per colonna
            year: string,
            periodList: {
                employee: string,
                autonomous: string,
                total: string
            },
            average: { //media valori per riga
                employee: number,
                autonomous: number,
                total: number
            }
        },
        territorialWorkforce: {//valori per colonna
            municipality: string,
            periodList: {
                employee: string,
                autonomous: string,
                total: string
            },
            average: { //media valori per riga
                employee: number
                autonomous: number
                total: number
            }
        },
        secondaryAddress?: {
            secondaryRoute?: string,
            secondaryStreet?: string,
            secondaryStreetNo?: string,
            secondaryCity?: string,
            secondaryPostCode?: string,
            secondaryProvinceCode?: string
        }
    },
    bankingRelationships?: BankingRelationship[],
    contactPhoneNumber?: RecapitiTelefonici[],
    notePhoneNumber?: RecapitiTelefonici[],
    companyShareholdings?: any,
    attractiveMember?: any
    buildings?: Buildings,
    recoverabilityJudgment?: string | boolean,
    isOperativity?: boolean,
    operativity?: string,
    vehicles?: {
        vehiclesSocieta: Pra[],
        vehiclesPersona: Pra[]
    },
    negotiationInvestigations?: {
        investigationsSocieta: any[],
        investigationsPersona: any[]
    },
    negativity?: {
        protests: {
            flag?: boolean,
            details?: {
                values: descriptionProtest[],
                count: number,
                lastest: string,
                totalAmout: string
            }
        },
        prejudicial: {
            value?: boolean,
            details?: descriptionPrejudicial[]
        },
        insolvencyProceedings: {
            value?: boolean,
            description?: descriptionInsolvencyProceeding[]
        }
    },
    negativityOwner?: {
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
            details?: {
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
    availability?: string[],
    isReperibilita?: boolean,
    registryOwner?: any,
    positionsInCompany?: {
        activePositions: any[],
        pastPositions: any[]
    },
    workingActivity?: {
        pension: any[],
        activityJob: any[],
        freelancer: boolean
    },
    furtherInformation?: {
        numberOfOfficeHolders: string,
        numberOfTransferSite?: string
    }
    mortgageInsights?: string,
    availabilityLegalRepresentative?: string[],
    positionsInCompanyLegalRepresentative?: {
        activePositions: any[],
        pastPositions: any[]
    },
    legalHoldingsRepresentative?: any,
    domicile?: Object,
    legalRapresentativeInfo?: AnagraficaPersonaFisica
    legalRapresentativePersonalData?: any
    relationshipLegal?: BankingRelationshipsLegalRepresentative[];
}

export interface BalanceDetail {
    productionValue: string,
    revenues: string,
    cashFlow: string,
    profitLoss: string,
    active: string,
    fixedAssets: string,
    netAssets: string,
    numberOfEmployees?: string,
    sales: string,
    tfr: string,
    creditToMembers: string
}

export interface Members {
    name: string,
    percentage: string,
    perc: string | number
}

export interface BalanceDetailWithColor {
    productionValue: {
        value: string,
        color: string
    },
    revenues: {
        value: string,
        color: string
    },
    cashFlow: {
        value: string,
        color: string
    },
    profitLoss: {
        value: string,
        color: string
    },
    active: {
        value: string,
        color: string
    },
    fixedAssets: {
        value: string,
        color: string
    },
    netAssets: {
        value: string,
        color: string
    },
    numberOfEmployees?: {
        value: string,
        color: string
    }
    sales?: {
        value: string,
        color: string
    }
    // creditToMembers?: {
    //     value: string,
    //     color: string
    // }
    tfr?: {
        value: string,
        color: string
    }
}

export interface InvestigationRecords {
    contiCorrenti: ContoCorrente[],
    recapitiTelefonici: RecapitiTelefonici[],
    veicoli: {
        vehiclesSocieta: Veicolo[],
        vehiclesPersona: Veicolo[]
    },
    giudizioRecuperabilita: string,
    operativita: string,
    approfondimentiIpotecari: string,
    indaginiNegoziali: {
        investigationsSocieta: any[],
        investigationsPersona: any[]
    },
    residenze: string[],
    domicilio: Object,
    erediAccettanti?: Eredi[],
    erediChiamati?: Eredi[]
}

export interface RecapitiTelefonici {
    fixed: boolean,
    contact: string,
    note?: string
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
    province: string,
    note?: string
}
export interface Eredi {
    surname: string
    firstName: string,
    taxIdCode: string,
    address: string,
    postalCode: string,
    city: string,
    province: string,
    telephones?: string[],
    buildings?: boolean,
    dateOfBirth: string,
    countryOfBirth: string,
    birthPlace: string,
    accettaEredita:boolean,
    parentela: string
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

export interface Pra {
    brand: string;
    type: string; //serie targa
    registrationDate: string;
    plate: string;
    frameNumber: string;
    subjectRole: string;
    model: string;
    series: string;
    typeVehicle : string;
    roleDate : string;
    provinceComp : string;
}

export interface BankingRelationshipsLegalRepresentative {
    notes: string,
    present: string,
    bankCompanyName: string,
    bankVATNumber: string,
    toponymAddress: string,
    streetAddress: string,
    civicAddress: string,
    addressAt: string,
    commonAddress: string,
    postalAddress: string,
    provinceAddress: string,
    stateAddress: string,
    abi: string,
    cab: string,
    active: string,
    protest : string,
    collectedAt: string,
    address: string
}

export interface PrejudicialDB {
    titleDescription: string,
    stipulationDate: string,
    publicOfficial: string,
    site: string,
    province: string,
    TaxIDCode: string,
    speciesAct: string,
    codeAct: string,
    amountEntered: string,
    guaranteedAmount: string,
    negotiatingUnits: string,
    subjectFavor: string,
    subjectAgainst: string,
    collectedAt: string,
}


export interface Buildings {
    find: boolean,
    data: BuildingWithoutEstimation[] | BuildingWithEstimation
}

export interface BuildingWithoutEstimation {
    city: string,
    rows: Building
}

export interface Building {
    city: string,
    landRegister: string,
    address: string,
    sheetPartSub: string,
    classamento: string,
    class: string,
    conservatory: string,
    annuity: string
}

export interface BuildingWithEstimation {
    lands: any[],
    buildings: any[]
}

export interface BankingRelationship extends ContoCorrente {
    address: string
}

export interface CompanyShareholding {
    company: string,
    taxCode: string,
    legalForm: string,
    capitalValue?: string,
    depositDate?: string,
    protocolNumber?: string,
    site?: string,
    activityStatus?: string,
    typeOfactivity?: string,
    revenues?: string,
    charges?: string,
    position?: string,
    nominalValue?: string,
    possessionPercentage?: string,
    straightDescription?: string,
}

export interface descriptionPrejudicial {
    title: string,
    conservatory: string,
    actDate: string,
    generalNumberDetail: string,
    actCode: string,
    amount: string,
    guaranteedAmount: string,
    subjectAgainst: {
        name: string,
        taxCode: string
    },
    subjectFavour: string
}

export interface descriptionProtest {
    title: string,
    taxCode: string,
    address: string,
    levata: string,
    registrationData: string,
    typeOfEffect: string,
    amount: string,
    causal: string
}

export interface descriptionInsolvencyProceeding {
    title: string,
    taxCode: string,
    address: string,
    act: string,
    startDate: string,
    registrationDate: string
}

export const LegalFormSC: string[] = [
    'az.aut.',
    'az.mun.',
    'az.prov.',
    'az.reg.',
    'az.spec.',
    'c.f.',
    'consorzio',
    'contratto di rete con sogg.giur.',
    'ente',
    'fondazione',
    'g.e.i.e.',
    'is.credito',
    'mutua ass.',
    's.p.a.u.s.',
    's.r.l.',
    's.r.l.c.r.',
    's.r.l.u.s.',
    's.r.l.s.',
    'coop.',
    's.c.eu.',
    'altro',
    'mutuo socc',
    's.eu.',
    's.a.p.a.',
    's.p.a.',
    'sc'
]

export const LegalFormSP: string[] = [
    'assoc.',
    'ass.part.',
    'coop.',
    'consortile',
    's.d.f.',
    's.a.s.',
    's.n.c.',
    'semplice',
    'altro',
    "societa' in accomandita semplice",
    'sp'
]

export const legalFormDI: string[] = [
    'im.famil.',
    'indiv.',
    'individuale',
    'di'
]

export const legalFormAL: string[] = [
    'altro',
    'assoc.',
    'az.spec.',
    'comunione',
    'consorzio',
    'ente',
    'fondazione',
    'ist.relig.',
    'pers.Fis.',
    'anonima',
    'irregolare',
    'estera'
]

