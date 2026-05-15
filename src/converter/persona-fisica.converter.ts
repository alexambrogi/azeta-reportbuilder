import { ICribisPersonaFisica } from "../models/persona-fisica.model";
import { Sequelize } from "sequelize"
import { CustomError, companyShareholdingsPersonaFisica, convertBuilding, convertDetailsPrejudicialPersonaFisica, convertPrejudicialPersonaFisica, convertdescriptionProtestPersonaFisica, getAnagraDecesso, getAnagraficaPersonaFisica, getApprofondimentiIpotecari, getAttivitaLavorativa, getCaricheInImprese, getGiudizioRecuperabilita, getIndaginiNegoziali, getInvestigationRecordsBySubjectLegalForm, getRapportiBancari, getRecapitiTelefonici,getNoteTelefonici, getRecoverabilityJudgment, getReperibilita, getVeicoli, valueFromResponsePurchase } from "../utils";
import moment from "moment";
import { InputDataCustomer } from "../models/sftp.model";
import { InvestigationRecords } from "../models/persona-giuridica.model";
import { ExecutionJob } from "../models/logger.model";
import { getInformazione } from "./money-plus-persona-giuridica.converter";
import { CodiciFiscaliAndCustomCode } from "../models/ciro.model";

export const personaFisicaConverter = async (
    pgConnection: Sequelize,
    investigation_record_id: string,
    investigated_subject_id: string,
    codiceFiscale: string,
    dateOfRequest: string,
    productPurchaseResponse: { [key: string]: any },
    campaign_kind_id: string,
    executionJob: ExecutionJob,
    codiciFiscaliAndCustomCode: CodiciFiscaliAndCustomCode[],
    customerInput?: InputDataCustomer,
): Promise<ICribisPersonaFisica | false> => {
    const valuesPurchase = await valueFromResponsePurchase(productPurchaseResponse)
    if (valuesPurchase === false) return false

    const anagrafica = await getAnagraficaPersonaFisica(investigation_record_id, pgConnection)
    if (anagrafica === false) return false

    const { reperibilita, isReperibilita } = await getReperibilita(investigation_record_id, pgConnection, anagrafica)
    if (reperibilita === null) return false

    const recapitiTelefonici = await getRecapitiTelefonici(investigation_record_id, pgConnection)
    if (recapitiTelefonici === false) return false

    const noteTelefonici = await getNoteTelefonici(investigation_record_id, pgConnection)
    if (noteTelefonici === false) return false


    const veicoli = await getVeicoli(investigation_record_id, pgConnection)
    if (veicoli === false) return false

    const rapportiBancari = await getRapportiBancari(investigation_record_id, pgConnection)
    if (rapportiBancari === false) return false

    const attivitaLavorativa = await getAttivitaLavorativa(investigation_record_id, pgConnection)
    if (attivitaLavorativa === false) return false

    const approfondimentiIpotecari = await getApprofondimentiIpotecari(investigation_record_id, pgConnection)
    if (approfondimentiIpotecari === false) return false


    const investigationRecords: InvestigationRecords | false = await getInvestigationRecordsBySubjectLegalForm(pgConnection, investigation_record_id);
    if (investigationRecords === false) return false


    const result = {
        informazioneN: getInformazione(codiciFiscaliAndCustomCode, codiceFiscale),
        campaign_kind_id,
        inputData: {
            dateFulfillment: moment(new Date).format('DD/MM/YYYY'),
            dateRequested: dateOfRequest,
            numberInformation: '',
            refCustomer: customerInput?.refCustomer || ''
        },
        registry: anagrafica,

    } as ICribisPersonaFisica;
    console.log("[INFO]")


    try {
        if (['683', '696', '713', '703', '693', '712', '715', '707', '709', '811', '768','818'].includes(campaign_kind_id)) {
            result.availability = reperibilita;
            result.isReperibilita = isReperibilita;
        }
        if (campaign_kind_id === '683' || campaign_kind_id === '696' || campaign_kind_id === '713' || campaign_kind_id === '706' || campaign_kind_id === '703' || campaign_kind_id === "693" || campaign_kind_id === "712" || campaign_kind_id === "715" || campaign_kind_id === "705" || campaign_kind_id === "768" || campaign_kind_id === "818") {
            result.contactPhoneNumber = recapitiTelefonici;
            result.notePhoneNumber = noteTelefonici;
            result.workingActivity = attivitaLavorativa;
            result.negativity = getNegativity(valuesPurchase)
            result.bankingRelationships = rapportiBancari;
            result.positionsInCompany = await getCaricheInImprese(valuesPurchase?.PositionsInCompanies)
            result.companyShareholdings = companyShareholdingsPersonaFisica(valuesPurchase?.Shareholdings?.List?.Shareholding);
        }
        if (campaign_kind_id === '683' || campaign_kind_id === '712' || campaign_kind_id === "768" || campaign_kind_id === "818") {
            result.buildings = await convertBuilding(codiceFiscale, true);
            result.bankingRelationships = rapportiBancari;
            result.vehicles = veicoli;
            result.recoverabilityJudgment = getRecoverabilityJudgment(result, 'PersonaFisica');
            result.companyShareholdings = companyShareholdingsPersonaFisica(valuesPurchase?.Shareholdings?.List?.Shareholding);
        } else if (campaign_kind_id === '696') {
            result.negotiationInvestigations = await getIndaginiNegoziali(investigation_record_id, pgConnection);
            result.buildings = await convertBuilding(codiceFiscale, true);
            result.bankingRelationships = rapportiBancari;
            result.vehicles = veicoli;
            result.recoverabilityJudgment = getRecoverabilityJudgment(result, 'PersonaFisica');
            result.companyShareholdings = companyShareholdingsPersonaFisica(valuesPurchase?.Shareholdings?.List?.Shareholding);
        } else if (campaign_kind_id === '818') {
            result.negotiationInvestigations = await getIndaginiNegoziali(investigation_record_id, pgConnection);
            result.buildings = await convertBuilding(codiceFiscale, true);
            result.bankingRelationships = rapportiBancari;
            result.vehicles = veicoli;
            result.recoverabilityJudgment = getRecoverabilityJudgment(result, 'PersonaFisica');
            result.availability = reperibilita;
            result.isReperibilita = isReperibilita;            
            const decesso = await getAnagraDecesso(investigation_record_id, pgConnection);            
            result.companyShareholdings = companyShareholdingsPersonaFisica(valuesPurchase?.Shareholdings?.List?.Shareholding);
        } else if (campaign_kind_id === '713') {
            result.buildings = await convertBuilding(codiceFiscale, true);
            result.bankingRelationships = rapportiBancari;
            result.vehicles = veicoli;
            result.availability = reperibilita;
            result.isReperibilita = isReperibilita;
            result.companyShareholdings = companyShareholdingsPersonaFisica(valuesPurchase?.Shareholdings?.List?.Shareholding);
        } else if (campaign_kind_id === '703') {
            result.buildings = await convertBuilding(codiceFiscale, true);
            result.vehicles = veicoli;
            result.companyShareholdings = companyShareholdingsPersonaFisica(valuesPurchase?.Shareholdings?.List?.Shareholding);
        } else if (campaign_kind_id === '707') {
            result.bankingRelationships = rapportiBancari;
            result.positionsInCompany = await getCaricheInImprese(valuesPurchase?.PositionsInCompanies);
            result.companyShareholdings = companyShareholdingsPersonaFisica(valuesPurchase?.Shareholdings?.List?.Shareholding)
        } else if (campaign_kind_id === '709' || campaign_kind_id === '792F') {
            result.bankingRelationships = rapportiBancari;
            result.positionsInCompany = await getCaricheInImprese(valuesPurchase?.PositionsInCompanies);
            result.companyShareholdings = companyShareholdingsPersonaFisica(valuesPurchase?.Shareholdings?.List?.Shareholding);
        } else if (campaign_kind_id === '768') {
            result.bankingRelationships = rapportiBancari;
            result.companyShareholdings = companyShareholdingsPersonaFisica(valuesPurchase?.Shareholdings?.List?.Shareholding);
        } else if (campaign_kind_id === '693') {
            result.inheritorsAccepting = investigationRecords.erediAccettanti;
            result.inheritorsCalled = investigationRecords.erediChiamati;
            result.mortgageInsights = approfondimentiIpotecari;
            result.buildings = await convertBuilding(codiceFiscale, true);
            result.recoverabilityJudgment = getRecoverabilityJudgment(result, 'PersonaFisica');
            result.companyShareholdings = companyShareholdingsPersonaFisica(valuesPurchase?.Shareholdings?.List?.Shareholding);
        } else if (campaign_kind_id === '811') {
            result.contactPhoneNumber = recapitiTelefonici;
            result.notePhoneNumber = noteTelefonici;
            result.domicile = investigationRecords.domicilio
        } else if (campaign_kind_id === '715') {
            result.vehicles = veicoli;
            result.buildings = await convertBuilding(codiceFiscale, false);
            const decesso = await getAnagraDecesso(investigation_record_id, pgConnection);
            result.esito = calculateEsito(decesso, attivitaLavorativa)
            result.recoverabilityJudgment = getRecoverabilityJudgment(result, 'PersonaFisica');
        }

        return result

    } catch (error) {
        console.error(error);
        await executionJob.error((error as CustomError).message);
        return false
    }
}

export function getNegativity(valuesPurchase : any){
    return {
        protests: {
            flag: +valuesPurchase?.ProtestsAndPrejudicialEvents?.Protests?.ValidatedRecordsNumberOnPerson?._text > 0 ? true : false,
            details: convertdescriptionProtestPersonaFisica(valuesPurchase?.ProtestsAndPrejudicialEvents?.Protests?.ValidEvents?.Event)
        },
        prejudicial: {
            value: +valuesPurchase?.ProtestsAndPrejudicialEvents?.PrejudicialEvents?.ValidatedRecordsNumberOnPerson?._text > 0 ? true : false,
            prejudicials: convertPrejudicialPersonaFisica(valuesPurchase?.ProtestsAndPrejudicialEvents?.PrejudicialEvents),
            details: convertDetailsPrejudicialPersonaFisica(valuesPurchase?.ProtestsAndPrejudicialEvents?.PrejudicialEvents)
        },
        insolvencyProceedings: false
    }
}


export function calculateEsito(decesso: any, attivitaLavorativa: { pension: any[]; activityJob: any[]; freelancer: boolean; }) {

    //TODO implementare controllo su TKT
    if (decesso !== false && decesso.dateOfDeath !== "") {
        if (attivitaLavorativa?.activityJob?.find((x: any) => x?.jobTitle === 'Pensionato' || x?.jobTitle === 'Dipendente')) {
            return true;
        } else {
            return false;
        }
    }
    else {
        return false;
    }
}