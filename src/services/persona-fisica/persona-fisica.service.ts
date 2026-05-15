import moment from "moment";
import { json, Sequelize } from "sequelize";
import Client from 'ssh2-sftp-client';
import { personaFisicaConverter } from "../../converter/persona-fisica.converter";
import { generateQueryVerifyClosedEntrust, insertJsonReportToCiro, generateQueryVerifyNewEntrust, setStateEntrusts, setStateEntrustsAssignment, setStateEntrustsRequest } from "../../database/postgres/query/postgres.query";
import { ExecutionJob } from "../../models/logger.model";
import { ICribisPersonaFisica } from "../../models/persona-fisica.model";
import { InputDataCustomer } from "../../models/sftp.model";
import { CustomError, addSommario, convertHtml2PDF, findMainDocumentMongoReportImprenditore, findMainDocumentMongoPersonaFisica, getFooter, getHeader, getOptions, PATHFILE, removeLocalPDF, saveFileCiro, sftpCreateFolder, sftpTransferFile, templateInterpolation } from "../../utils";
import { closedDiba } from "../diba-external.service";
import { CodiciFiscaliAndCustomCode } from "../../models/ciro.model";
import { sendFileWithSFTP } from "../sftp-external.service";
import { closeEntrustedAndEntrustedRequest } from "../db-ciro-entrusted.service";

export const personaFisicaService = async (id_request: string, codiceFiscale: string, dateOfRequest: string, sftp: Client, pgConnection: Sequelize, investigation_record_id: string, investigated_subject_id: string, customer_id: string, campaign_kind_id: string, id_entrust: string, author_id: string, entrust_code: string, codiciFiscaliAndCustomCode: CodiciFiscaliAndCustomCode[], isControlCerved?: boolean, customerInput?: InputDataCustomer, ck_name?: any) => {
        const executionJob = new ExecutionJob();
        try {
                console.log('--- INIZIO PERSONA FISICA')

                let templateInterpolated: any;
                let nameFile: string = '';

                // Chiamata Cerved
                let productPurchaseResponse: any = await findMainDocumentMongoReportImprenditore(id_request, codiceFiscale, dateOfRequest, investigation_record_id)
                if (productPurchaseResponse === false)
                        productPurchaseResponse = await findMainDocumentMongoPersonaFisica(id_request, codiceFiscale, dateOfRequest, investigation_record_id)
                if (productPurchaseResponse === false)
                        productPurchaseResponse = {}


                // Mapping dell'oggetto e interpolazione del template
                const jsonMapped = await personaFisicaConverter(pgConnection, investigation_record_id, investigated_subject_id, codiceFiscale, dateOfRequest, productPurchaseResponse?.json, campaign_kind_id, executionJob, codiciFiscaliAndCustomCode, customerInput)
                if (jsonMapped === false) return

                switch (customer_id.toString()) {
                        case '3387':
                                await insertJsonReportToCiro(pgConnection,jsonMapped.informazioneN,'CRIBIS',jsonMapped);
                                break;
                        case '4454':
                                await insertJsonReportToCiro(pgConnection,jsonMapped.informazioneN,'INAGEC',jsonMapped);
                                break;
                        default:
                                break;
                }

               // await pgConnection.query(strQuery);     
                 

                if(!customer_id.toString().includes('3387') && customer_id.toString() !=='20' && customer_id.toString() !== '4902') 
                        jsonMapped.nomeDocumento = ck_name
                switch (campaign_kind_id) {
                        case '707': //Money plus - persona fisica
                                templateInterpolated = await templateInterpolation<ICribisPersonaFisica>(process.env.SRC_PERSONA_FISICA_MONEY_PLUS_OR_LIGHT as string, jsonMapped)
                                if (templateInterpolated === false) return
                                nameFile = `PERSONA_FISICA_MONEY_PLUS_${id_request}_${codiceFiscale}.pdf`
                                break;
                        case '709': //Money light - persona fisica
                                templateInterpolated = await templateInterpolation<ICribisPersonaFisica>(process.env.SRC_PERSONA_FISICA_MONEY_PLUS_OR_LIGHT as string, jsonMapped)
                                if (templateInterpolated === false) return
                                nameFile = `PERSONA_FISICA_MONEY_LIGHT_${id_request}_${codiceFiscale}.pdf`
                                break;
                        case '792F': 
                                jsonMapped.nomeDocumento = ck_name
                                templateInterpolated = await templateInterpolation<ICribisPersonaFisica>(process.env.SRC_PERSONA_FISICA_MONEY_PLUS_OR_LIGHT as string, jsonMapped)
                                if (templateInterpolated === false) return
                                nameFile = `PERSONA_FISICA_REFERENZE_BANCARIE_${id_request}_${codiceFiscale}.pdf`
                                break;
                        case '811': //Rintraccio Anagrafico - persona fisica
                                templateInterpolated = await templateInterpolation<ICribisPersonaFisica>(process.env.SRC_PERSONA_FISICA_RINTRACCIO_ANAGRAFICO as string, jsonMapped)
                                if (templateInterpolated === false) return
                                nameFile = `PERSONA_FISICA_RINTRACCIO_ANAGRAFICO_${id_request}_${codiceFiscale}.pdf`
                                break;
                        case '696': //indagine search approfonditi - persona fisica
                        case '683': //indagine search - persona fisica
                        case '713': //indagine search ligth - persona fisica
                        case '703': //platinum - persona fisica
                        case '693': // tlc - pf
                        case '715': // go/no go - pf
                        case '712': //indagine search - persona fisica
                        case '768': //cribis medium
                        case '705': //rintraccio professione
                        case '706': //rintraccio professione light
                        case '818': //indagine search approfonditi - persona fisica
                                templateInterpolated = await templateInterpolation<ICribisPersonaFisica>(process.env.SRC_PERSONA_FISICA as string, jsonMapped)
                                if (templateInterpolated === false) return
                                switch (campaign_kind_id) {
                                        case '696':
                                                nameFile = `PERSONA_FISICA_SEARCH_APPROFONDITO_${id_request}_${codiceFiscale}.pdf`
                                                break;
                                        case '683':
                                                nameFile = `PERSONA_FISICA_SEARCH_${id_request}_${codiceFiscale}.pdf`
                                                break;
                                        case '712':
                                                nameFile = `PERSONA_FISICA_SEARCH_${id_request}_${codiceFiscale}.pdf`
                                                break;
                                        case '713':
                                                nameFile = `PERSONA_FISICA_SEARCH_LIGHT_${id_request}_${codiceFiscale}.pdf`
                                                break;
                                        case '703':
                                                nameFile = `PERSONA_FISICA_PLATINUM_${id_request}_${codiceFiscale}.pdf`
                                                break;
                                        case '693':
                                                nameFile = `PERSONA_FISICA_TLC_${id_request}_${codiceFiscale}.pdf`
                                                break;
                                        case '715':
                                                nameFile = `PERSONA_FISICA_GO_NO_GO_${id_request}_${codiceFiscale}.pdf`
                                                break;
                                        case '768':
                                                nameFile = `PERSONA_FISICA_SEARCH_MEDIUM_${id_request}_${codiceFiscale}.pdf`
                                                break;
                                        case '705':
                                                nameFile = `PERSONA_FISICA_RINTRACCIO_PROFESSIONALE_${id_request}_${codiceFiscale}.pdf`
                                                break;
                                        case '706':
                                                nameFile = `PERSONA_FISICA_RINTRACCIO_PROFESSIONALE_LIGHT_${id_request}_${codiceFiscale}.pdf`
                                                break;
                                        case '818':
                                                nameFile = `RINTRACCIO_PATRIMONIALE_GOLD_PF_${id_request}_${codiceFiscale}.pdf`
                                                break;
                                }
                                break;
                }

                if (isControlCerved) {
                        const now = moment(new Date()).format('DD/MM/YYYY HH:mm:ss');
                        await pgConnection.query(setStateEntrustsAssignment(investigation_record_id, 'preparation', now))
                        await pgConnection.query(setStateEntrustsRequest(id_request, 'entrusted', now))
                        // const [results, metadata] = await pgConnection.query(generateQueryVerifyNewEntrust(id_entrust));
                        // if(!(results.length))
                        await pgConnection.query(setStateEntrusts(id_entrust, 'preparation', now))
                        console.log('il codice fiscale %s , con entrust %s é stato controllato e risulta ok', codiceFiscale, id_entrust)
                        return
                }
                // Converte in PDF e salva localmente
                let options;
               switch (customer_id.toString()) {
                    case '3387':
                         options = getOptions(await getHeader(process.env.SRC_HEADER as string,customer_id), await getFooter(process.env.SRC_FOOTER as string,customer_id), customer_id)
                         break;
                    case '4902':
                        options = getOptions(await getHeader(process.env.SRC_HEADER_AZ as string,customer_id), await getFooter(process.env.SRC_FOOTER_AZ as string,customer_id), customer_id)
                         break;
                    default:
                        options = getOptions(await getHeader(process.env.SRC_HEADER_BLANK as string,customer_id), await getFooter(process.env.SRC_FOOTER_BLANK as string,customer_id), customer_id)
               }                
                /*
                if (customer_id.toString().includes('3387')) {
                        options = getOptions(await getHeader(process.env.SRC_HEADER as string), await getFooter(process.env.SRC_FOOTER as string))
                } else {
                        options = getOptions(await getHeader(process.env.SRC_HEADER_BLANK as string), await getFooter(process.env.SRC_FOOTER_BLANK as string))

                }
                */
                let convertHtmlToPDF = await convertHtml2PDF(templateInterpolated, PATHFILE, nameFile as string, options);
                if (convertHtmlToPDF === false) return

                templateInterpolated = await addSommario(nameFile as string, PATHFILE, templateInterpolated, options);
                if (templateInterpolated === false) return

                // // Starto la transazione per il processo di salvataggio
                const transaction = await pgConnection.transaction();

                const res = await sendFileWithSFTP(nameFile,PATHFILE,author_id,id_request,transaction,pgConnection,sftp);
                if(res === false) return

                //Update campo 'state' DB
                await closeEntrustedAndEntrustedRequest(executionJob,transaction,pgConnection,investigation_record_id,id_request,id_entrust,campaign_kind_id,entrust_code)


                // Effettuo il commit della transaction
                await transaction.commit()

                console.log('--- FINE PERSONA FISICA')
        }
        catch (error) {
                console.log('---- ERROR: ', error)
                await executionJob.error((error as CustomError).message);
        }
}