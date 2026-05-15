import { Sequelize } from "sequelize";
import { ICribisEredi } from "../models/eredi.model";
import { ExecutionJob } from "../models/logger.model";
import { InputDataCustomer } from "../models/sftp.model";
import { convertBuilding, CustomError, getAcceptingHeirs, getAnagraDecesso, getNoteDaConservatoria, getSearchHeirs, splittaNotaConservatoria } from "../utils";
import moment from "moment";
import { CodiciFiscaliAndCustomCode } from "../models/ciro.model";
import { getInformazione } from "./money-plus-persona-giuridica.converter";

export const erediConverter = async (
    pgConnection: Sequelize,
    investigation_record_id: string,
    investigated_subject_id: string,
    codiceFiscale: string,
    dateOfRequest: string,
    campaign_kind_id: string,
    executionJob: ExecutionJob,
    codiciFiscaliAndCustomCode: CodiciFiscaliAndCustomCode[],
    customerInput?: InputDataCustomer,
): Promise<ICribisEredi | false> => {

    //recuperiamo l'anagrafica usando il metodo persona fisica
    const anagrafica = await getAnagraDecesso(investigation_record_id, pgConnection)
    if (anagrafica === false) return false
    //recuperiamo gli eredi chiamati
    const searchHeirs = await getSearchHeirs(investigation_record_id, pgConnection)
    //recuperiamo gli eredi accettanti
    const acceptingHeirs = await getAcceptingHeirs(investigation_record_id, pgConnection)

    const noteConservatoria = await getNoteDaConservatoria(codiceFiscale, pgConnection)
    if(noteConservatoria === false) return false

    try {
        const result = {
            informazioneN:  getInformazione(codiciFiscaliAndCustomCode,codiceFiscale),
            campaign_kind_id,
            inputData: {
                dateFulfillment: moment(new Date).format('DD/MM/YYYY'),
                dateRequested: dateOfRequest,
                numberInformation: '',
                refCustomer: customerInput?.refCustomer || ''
            },
            registry: anagrafica,
            searchHeirs,
            conservatoryNote: noteConservatoria,
            notaConservatoriaObject: splittaNotaConservatoria(noteConservatoria)
        } as ICribisEredi;

        switch (campaign_kind_id) {
            case '700': //eredi plus    // CODICE DA CAMBIARE
                // accettanti
                result.acceptingHeirs = acceptingHeirs
                if(acceptingHeirs){
                    acceptingHeirs.forEach(acceptingHeir =>{
                        if(acceptingHeir.accettaEredita) {
                            result.isAccettata = true;                          
                        }
                    }
                    )
                }
                break;            
            case '701': //eredi medium  // CODICE DA CAMBIARE
                // accettanti
                result.acceptingHeirs = acceptingHeirs
                if(acceptingHeirs){
                    acceptingHeirs.forEach(acceptingHeir =>{
                        if(acceptingHeir.accettaEredita)
                            result.isAccettata = true
                    }
                    )
                }
                result.conservatoryNote= noteConservatoria

                break;
            case '702': //eredi plus    // CODICE DA CAMBIARE
                // accettanti
                result.acceptingHeirs = acceptingHeirs
                if(acceptingHeirs){
                    acceptingHeirs.forEach(acceptingHeir =>{
                        if(acceptingHeir.accettaEredita)
                            result.isAccettata = true
                    }
                    )
                }
                // immobili (senza stima)
                result.buildings = await convertBuilding(codiceFiscale, false);
                break;
        }

        return result
    } catch (error) {
        console.error(error);
        await executionJob.error((error as CustomError).message);
        return false
    }
}