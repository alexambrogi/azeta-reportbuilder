import moment from "moment";
import { Sequelize } from "sequelize";
import Client from 'ssh2-sftp-client';
import { erediConverter } from "../converter/eredi.converter";
import { insertJsonReportToCiro, generateQueryVerifyClosedEntrust, generateQueryVerifyNewEntrust, setStateEntrusts, setStateEntrustsAssignment, setStateEntrustsRequest } from "../database/postgres/query/postgres.query";
import { ICribisEredi } from "../models/eredi.model";
import { ExecutionJob } from "../models/logger.model";
import { InputDataCustomer } from "../models/sftp.model";
import { addSommario, convertHtml2PDF, CustomError, getFooter, getHeader, getOptions, PATHFILE, removeLocalPDF, saveFileCiro, sftpCreateFolder, sftpTransferFile, templateInterpolation } from "../utils";
import { closedDiba } from "./diba-external.service";
import { sendFileWithSFTP } from "./sftp-external.service";
import { closeEntrustedAndEntrustedRequest } from "./db-ciro-entrusted.service";

export const erediService = async (id_request: string, codiceFiscale: string, dateOfRequest: string, sftp: Client, pgConnection: Sequelize, investigation_record_id: string, investigated_subject_id: string, customer_id: string, campaign_kind_id: string, id_entrust: string, author_id: string, entrust_code: string, codiciFiscaliAndCustomCode: any, isControlCerved?: boolean, customerInput?: InputDataCustomer, ck_name?: any) => {
    const executionJob = new ExecutionJob();
    try {
        console.log('--- INIZIO EREDI')

        let templateInterpolated: any;
        let nameFile: string = '';

        // Mapping dell'oggetto e interpolazione del template
        const jsonMapped = await erediConverter(pgConnection, investigation_record_id, investigated_subject_id, codiceFiscale, dateOfRequest, campaign_kind_id, executionJob,codiciFiscaliAndCustomCode, customerInput)
        if (jsonMapped === false) return
        if(!customer_id.toString().includes('3387') && customer_id.toString() !=='20' && customer_id.toString() !== '4902') 
                jsonMapped.nomeDocumento = ck_name
        templateInterpolated = await templateInterpolation<ICribisEredi>(process.env.SRC_EREDI as string, jsonMapped)
        if (templateInterpolated === false) return

        switch (campaign_kind_id) {
            case '702': //eredi plus    // CODICE DA CAMBIARE
                nameFile = `EREDI_PLUS_${id_request}_${codiceFiscale}.pdf`
                break;
            case '701': //eredi medium  // CODICE DA CAMBIARE
                nameFile = `EREDI_MEDIUM_${id_request}_${codiceFiscale}.pdf`
                break;
            case '700': //eredi basic   // CODICE DA CAMBIARE
                nameFile = `EREDI_BASIC_${id_request}_${codiceFiscale}.pdf`
                break;
            }
        if(isControlCerved){
            const now = moment(new Date()).format('DD/MM/YYYY HH:mm:ss');
            await pgConnection.query(setStateEntrustsAssignment(investigation_record_id,'preparation',now))
            await pgConnection.query(setStateEntrustsRequest(id_request,'entrusted',now))
            // const [results, metadata] = await pgConnection.query(generateQueryVerifyNewEntrust(id_entrust));
            // if(!(results.length))
                 await pgConnection.query(setStateEntrusts(id_entrust,'preparation',now))
            console.log('il codice fiscale %s , con entrust %s é stato controllato e risulta ok',codiceFiscale,id_entrust)
            return
        }
        // Converte in PDF e salva localmente
        let options;

        //blank item
        switch (customer_id.toString()) {
            case '3387':
                    options = getOptions(await getHeader(process.env.SRC_HEADER as string), await getFooter(process.env.SRC_FOOTER as string))
                    await insertJsonReportToCiro(pgConnection,jsonMapped.informazioneN,'CRIBIS',jsonMapped);          
                    break;
            case '4902':
                    options = getOptions(await getHeader(process.env.SRC_HEADER_BLANK as string), await getFooter(process.env.SRC_FOOTER_BLANK as string))
                    break;
            case '4454':
                    options = getOptions(await getHeader(process.env.SRC_HEADER_BLANK as string, customer_id), await getFooter(process.env.SRC_FOOTER_BLANK as string, customer_id), customer_id)
                    await insertJsonReportToCiro(pgConnection,jsonMapped.informazioneN,'INAGEC',jsonMapped);          
                    break;
            default:
                options = getOptions(await getHeader(process.env.SRC_HEADER_BLANK as string), await getFooter(process.env.SRC_FOOTER_BLANK as string))
        }



        if (customer_id.toString().includes('3387')) {
        } else {
                options = getOptions(await getHeader(process.env.SRC_HEADER_BLANK as string), await getFooter(process.env.SRC_FOOTER_BLANK as string))

        }



        let convertHtmlToPDF = await convertHtml2PDF(templateInterpolated,PATHFILE, nameFile, options);
        if (convertHtmlToPDF === false) return
        templateInterpolated = await addSommario(nameFile as string,PATHFILE,templateInterpolated,options);
        if(templateInterpolated === false) return   


        // Starto la transazione per il processo di salvataggio
        const transaction = await pgConnection.transaction();

        const res = await sendFileWithSFTP(nameFile,PATHFILE,author_id,id_request,transaction,pgConnection,sftp);
        if(res === false) return
        
        //Update campo 'state' DB
        await closeEntrustedAndEntrustedRequest(executionJob,transaction,pgConnection,investigation_record_id,id_request,id_entrust,campaign_kind_id,entrust_code)

        // Effettuo il commit della transaction
        await transaction.commit()
        console.log('--- FINE EREDI')
    }
    catch (error) {
        console.log('---- ERROR: ', error)
        await executionJob.error((error as CustomError).message);
    }
}