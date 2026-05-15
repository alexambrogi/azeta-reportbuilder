import { BalanceDetail, BalanceDetailWithColor } from "./persona-giuridica.model"

export interface ICribisProspettoStorico {
    informazioneN? : string,
    registry?: { //Anagrafica
        businessName: string,
        taxCode: string,
        iva: string,
        codeREAWithProvince: string,
        codeREA: string,
        site: string,
        legalForm: string,
        stateOfCompany: string,
        startCompanyDate: string,
        authorizedSocialCapital?: string,
        typeOfContribution: string,
        activity: string,
        raeCode: string,
        saeCode: string,
        naceCode?: string,
        certifiedEmail: string,
        dateIncorporation: string,
        expectedEndDate?: string,
        section?: string,
        phone?: string,
        fax?: string,
        performedActivity: string,
        subscribedSocialCapital: string,
        paidUpSocialCapital: string,
        euro: string,
        eu: string
    },
    legalData?: {
        dateIscription?: string,
        companyRegisterBusiness: string,
        section?: string,
        dateForTheSection?: string,
    },
    informationStatute: {
        dateCostitution: string,
        endDate: string,
        socialObject: string,
        socialPacts: string,
        withdrawalClauses: {
            title: string,
            text: string
        },
        preEmptionClauses: {
            title: string,
            text: string
        },
        exclusionClauses: {
            title: string,
            text: string
        },
        dateOfIncorporation: string,
    },

    legalEvents: {
        actDate: string,
        filingDate: string,
        protocolDate: string,
        numberProtocol: string,
        notary: string,
        referenceNo: string,
        denominationReported: string,
        subjectAssignor: string,
        taxCodeAssignor: string,
        transferee: string,
        subjectTransferee: string,
        taxCodeTransferee: string,
    }

    activityCharacteristics: Array<string>
    lifeTimeClassification: string,

    annualEmployees?: { //Soci
        employeeNumber: string,
        employeeIndipendentNumber: string,
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
    administration: {
        form?: string
        systemOfAdministration?: string,
        administrationForm?: string,
        numberOfAdministration: string
    },
    membersInfo: {
        dateListOfMembers: string,
        dateStorageMembers: string,
        protocolNumber: string,

    },
    exponents?: Array<any>,
    countOfMayors?: number,
    positionHeld?: Array<any>,

    members : Array<any>,
    membersNumber: number

    questions: {
        year: string,
        month: string,
        number: string,
    }[]

    balance?: {
        referenceYears: string[],
        balanceDetails: BalanceDetail[],
        balanceDetailsPercentage : BalanceDetailWithColor[]
    },
}

