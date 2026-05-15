import moment from "moment";
import { Sequelize } from "sequelize";
import Client from 'ssh2-sftp-client';
import { sendEmail } from "../../connection/sendEmail";
import { moneyLightPersonaGiuridicaConverter } from "../../converter/money-light-persona-giuridica.converter";
import { moneyPlusPersonaGiuridicaConverter } from "../../converter/money-plus-persona-giuridica.converter";
import { personaGiuridicaDittaIndividualeConverter } from "../../converter/persona-giuridica-ditta-individuale.converter";
import { personaGiuridicaNoCorporateConverter } from "../../converter/persona-giuridica-no-corporate.converter";
import { personaGiuridicaConverter } from "../../converter/persona-giuridica.converter";
import { prospettoStoricoConverter } from "../../converter/prospetto-storico-persona-giuridica.converter";
import { generateQuerySelectAttachmentsByEntrustId, insertJsonReportToCiro, generateQueryVerifyClosedEntrust, generateQueryVerifyNewEntrust, setStateEntrusts, setStateEntrustsAssignment, setStateEntrustsRequest } from "../../database/postgres/query/postgres.query";
import { ExecutionJob } from "../../models/logger.model";
import { ICribisPersonaGiuridicaNoCorporate } from "../../models/persona-giuridica-no-corporate.model";
import { ICribisPersonaGiuridica, LegalFormSC, LegalFormSP, legalFormDI } from "../../models/persona-giuridica.model";
import { ICribisProspettoStorico } from "../../models/prospetto-storico.model";
import { InputDataCustomer } from "../../models/sftp.model";
import { CustomError, PATHFILE, addSommario, convertHtml2PDF, findProductPurchaseMongo, findProspectHistoryMongo, getAnagraficaImpresa, getCustomBilanci, getFooter, getHeader, getOptions, removeLocalPDF, saveFileCiro, sftpCreateFolder, sftpTransferFile, templateInterpolation } from "../../utils";
import { getCustomBilanciUnified } from "../../getCustomBilanciUnified";
import { CodiciFiscaliAndCustomCode } from "../../models/ciro.model";
import { sendFileWithSFTP } from "../sftp-external.service";
import { closeEntrustedAndEntrustedRequest } from "../db-ciro-entrusted.service";
export const personaGiuridicaService = async (id_request: string, codiceFiscale: string, dateOfRequest: string, sftp: Client, pgConnection: Sequelize, investigation_record_id: string, investigated_subject_id: string, customer_id: string, campaign_kind_id: string, id_entrust: string, author_id: string, entrust_code: string, codiciFiscaliAndCustomCode: CodiciFiscaliAndCustomCode[], customerInput?: InputDataCustomer, isControlCerved?: boolean, ck_name?: any) => {
     const executionJob = new ExecutionJob();
     try {
          console.log('--- INIZIO PERSONA GIURIDICA')

          let jsonMapped: any = {};
          let templateInterpolated: any;
          let nameReport = '';
          let isNoRea: any = false;

          //Chiamate a Cerved ProductPurchase e ProspectHistory
          const productPurchaseResponse: any = await findProductPurchaseMongo(id_request, codiceFiscale, dateOfRequest, investigation_record_id)
          if (productPurchaseResponse === true) {
               if (['769', '698', '684', '714', '694', '699', '704','875','801','819','792G'].includes(campaign_kind_id)) {
                    isNoRea = await getAnagraficaImpresa(investigation_record_id, pgConnection);
                    if (isNoRea === false)
                         return
                    else{
                         console.log(['PROBABILE NO REA'])
                    }
               } else {
                    return
               }
          } else if (productPurchaseResponse === false) {
               return
          }
          const prospectHistoryResponse: any = await findProspectHistoryMongo(id_request, codiceFiscale, dateOfRequest, investigation_record_id, productPurchaseResponse?.request_id)

          //Mapping dell'oggetto e interpolazione in base alla sigla legale

          const legalFormSubject = isNoRea ?
               isNoRea.legalFormType :
               productPurchaseResponse?.json?.CompanyReport?.ItemInformation?.CompanyInformation?.CompanyForm?._attributes?.LegalFormDescription

          console.log("legalFormSubject", legalFormSubject)

          let haveBilance

          
          switch (campaign_kind_id) {
               case '699': //Decodifica Partita Iva
                    jsonMapped = await moneyPlusPersonaGiuridicaConverter(pgConnection, investigation_record_id, dateOfRequest, campaign_kind_id, executionJob, codiceFiscale, codiciFiscaliAndCustomCode, customerInput, productPurchaseResponse?.json, prospectHistoryResponse?.json,isNoRea)
                    if (jsonMapped === false) return
                    if(!customer_id.toString().includes('3387') && customer_id.toString() !=='20' && customer_id.toString() !== '4902') 
                        jsonMapped.nomeDocumento = ck_name
                    nameReport = `DECODIFICA_PARTITA_IVA_${id_request}_${codiceFiscale}.pdf`;
                    templateInterpolated = await templateInterpolation<ICribisPersonaGiuridica>(process.env.SRC_MONEY_PLUS_PERSONA_GIURIDICA as string, jsonMapped)
                    break;
               case '708': //Money plus PersonaGiuridica
                    jsonMapped = await moneyPlusPersonaGiuridicaConverter(pgConnection, investigation_record_id, dateOfRequest, campaign_kind_id, executionJob, codiceFiscale, codiciFiscaliAndCustomCode, customerInput, productPurchaseResponse?.json, prospectHistoryResponse?.json)
                    if (jsonMapped === false) return
                    if(!customer_id.toString().includes('3387') && customer_id.toString() !=='20' && customer_id.toString() !== '4902') 
                        jsonMapped.nomeDocumento = ck_name
                    if(LegalFormSC.includes(legalFormSubject?.toLowerCase())){
                         haveBilance = await verificaBilancio(jsonMapped.balance, pgConnection, id_entrust, id_request, sftp, codiceFiscale, investigation_record_id)
                         if (haveBilance === false) return
                    }else{
                         haveBilance = false
                    }
                    jsonMapped.balance = haveBilance;
                    templateInterpolated = await templateInterpolation<ICribisPersonaGiuridica>(process.env.SRC_MONEY_PLUS_PERSONA_GIURIDICA as string, jsonMapped)
                    if (templateInterpolated === false) return
                    nameReport = `PERSONA_GIURIDICA_MONEY_PLUS_${id_request}_${codiceFiscale}.pdf`;
                    break;
               case '711': //Money Light Persona Giuridica 
                    jsonMapped = await moneyLightPersonaGiuridicaConverter(pgConnection, investigation_record_id, dateOfRequest, campaign_kind_id, executionJob, codiciFiscaliAndCustomCode, codiceFiscale, customerInput, productPurchaseResponse?.json, prospectHistoryResponse?.json)
                    if (jsonMapped === false) return
                    if(!customer_id.toString().includes('3387') && customer_id.toString() !=='20' && customer_id.toString() !== '4902') 
                        jsonMapped.nomeDocumento = ck_name
                    templateInterpolated = await templateInterpolation<ICribisPersonaGiuridica>(process.env.SRC_MONEY_LIGHT_PERSONA_GIURIDICA as string, jsonMapped)
                    if (templateInterpolated === false) return
                    nameReport = `PERSONA_GIURIDICA_MONEY_LIGHT_${id_request}_${codiceFiscale}.pdf`;
                    break;
               case '792G': //Money Light Persona Giuridica 
                    jsonMapped = await moneyPlusPersonaGiuridicaConverter(pgConnection, investigation_record_id, dateOfRequest, campaign_kind_id, executionJob, codiceFiscale, codiciFiscaliAndCustomCode, customerInput, productPurchaseResponse?.json, prospectHistoryResponse?.json,isNoRea)
                    if (jsonMapped === false) return
                    if(!customer_id.toString().includes('3387') && customer_id.toString() !=='20' && customer_id.toString() !== '4902') 
                        jsonMapped.nomeDocumento = ck_name
                    jsonMapped.nomeDocumento = ck_name
                    templateInterpolated = await templateInterpolation<ICribisPersonaGiuridica>(process.env.SRC_MONEY_LIGHT_PERSONA_GIURIDICA as string, jsonMapped)
                    if (templateInterpolated === false) return
                    nameReport = `PERSONA_GIURIDICA_REFERENZE_BANCARIE_${id_request}_${codiceFiscale}.pdf`;
                    break;
               case '698': //indagine search approfondito - persona giuridica
               case '684': //indagine search - persona giuridica
               case '714': //indagine search ligth - persona giuridica
               case '694': //TLC SRL - Persona Giuridica 
               case '704': //Platinum - Persona Giuridica   
               case '875': //Coface Persona Giuridica
               case '716': //GoNoGo - Persona Giuridica   
               case '769': //Medium - Persona Giuridica
               case '801': //Small - Persona Giuridica
               case '819':     
                    if (LegalFormSC.includes(legalFormSubject?.toLowerCase())) {
                         jsonMapped = await personaGiuridicaConverter(pgConnection, investigation_record_id, codiceFiscale, dateOfRequest, campaign_kind_id, executionJob, codiciFiscaliAndCustomCode, customerInput, productPurchaseResponse?.json, prospectHistoryResponse?.json, investigated_subject_id, isNoRea)
                         if (jsonMapped === false) return
                         if(!customer_id.toString().includes('3387') && customer_id.toString() !=='20' && customer_id.toString() !== '4902') 
                              jsonMapped.nomeDocumento = ck_name
                         if (['769','819'].includes(campaign_kind_id)) {
                              haveBilance = true;
                         }
                         else {
                              haveBilance = await verificaBilancio(jsonMapped.balance, pgConnection, id_entrust, id_request, sftp, codiceFiscale, investigation_record_id)
                         }
                         if (haveBilance === false && isNoRea === false)
                              return
                         else if (haveBilance === false)
                              haveBilance = { referenceYears: [] }
                         jsonMapped.balance = haveBilance;
                         switch (campaign_kind_id) {
                              case '698': nameReport = `PERSONA_GIURIDICA_SEARCH_APPROFONDITO_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case '684': nameReport = `PERSONA_GIURIDICA_SEARCH_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case '714': nameReport = `PERSONA_GIURIDICA_SEARCH_LIGHT_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case '694': nameReport = `PERSONA_GIURIDICA_TLC_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case "704": nameReport = `PERSONA_GIURIDICA_PLATINUM_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case "875": nameReport = `PERSONA_GIURIDICA_COFACE_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case "716": nameReport = `PERSONA_GIURIDICA_GO_NO_GO_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case "769": nameReport = `PERSONA_GIURIDICA_SEARCH_MEDIUM_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case "801": nameReport = `PERSONA_GIURIDICA_SEARCH_SMALL_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case '819': nameReport = `RINTRACCIO_PATRIMONIALE_GOLD_PG_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                         }
                         templateInterpolated = await templateInterpolation<ICribisPersonaGiuridica>(process.env.SRC_PERSONA_GIURIDICA as string, jsonMapped)
                         if (templateInterpolated === false) return
                    } else if (LegalFormSP.includes(legalFormSubject?.toLowerCase())) {
                         jsonMapped = await personaGiuridicaNoCorporateConverter(pgConnection, investigation_record_id, codiceFiscale, dateOfRequest, campaign_kind_id, executionJob, codiciFiscaliAndCustomCode, customerInput, productPurchaseResponse?.json, prospectHistoryResponse?.json, isNoRea, investigated_subject_id)
                         if (jsonMapped === false) return
                         if(!customer_id.toString().includes('3387') && customer_id.toString() !=='20' && customer_id.toString() !== '4902') 
                              jsonMapped.nomeDocumento = ck_name
                         templateInterpolated = await templateInterpolation<ICribisPersonaGiuridicaNoCorporate>(process.env.SRC_PERSONA_GIURIDICA_NO_CORPORATE as string, jsonMapped as ICribisPersonaGiuridicaNoCorporate)
                         if (templateInterpolated === false) return
                         switch (campaign_kind_id) {
                              case '698': nameReport = `PERSONA_GIURIDICA_NO_CORPORATE_SEARCH_APPROFONDITO_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case '684': nameReport = `PERSONA_GIURIDICA_NO_CORPORATE_SEARCH_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case '714': nameReport = `PERSONA_GIURIDICA_NO_CORPORATE_SEARCH_LIGHT_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case '694': nameReport = `PERSONA_GIURIDICA_NO_CORPORATE_TLC_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case "704": nameReport = `PERSONA_GIURIDICA_NO_CORPORATE_PLATINUM_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case "875": nameReport = `PERSONA_GIURIDICA_NO_CORPORATE_COFACE_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case "769": nameReport = `PERSONA_GIURIDICA_NO_CORPORATE_SEARCH_MEDIUM_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case "801": nameReport = `PERSONA_GIURIDICA_NO_CORPORATE_SEARCH_SMALL_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case "716": nameReport = `PERSONA_GIURIDICA_NO_CORPORATE_GO_NO_GO_${id_request}_${codiceFiscale}.pdf`;
                                   break;
                              case '819': nameReport = `RINTRACCIO_PATRIMONIALE_GOLD_PG_${id_request}_${codiceFiscale}.pdf`;
                                   break;                                   
                         }
                    } else if (legalFormDI) {
                         jsonMapped = await personaGiuridicaDittaIndividualeConverter(pgConnection, investigation_record_id, dateOfRequest, campaign_kind_id, executionJob, codiceFiscale, codiciFiscaliAndCustomCode, customerInput, productPurchaseResponse?.json, prospectHistoryResponse?.json, isNoRea)
                         if (jsonMapped === false) return
                         if(!customer_id.toString().includes('3387') && customer_id.toString() !=='20' && customer_id.toString() !== '4902') 
                              jsonMapped.nomeDocumento = ck_name
                         templateInterpolated = await templateInterpolation<ICribisPersonaGiuridica>(process.env.SRC_PERSONA_GIURIDICA_DITTA_INDIVIDUALE as string, jsonMapped)
                         if (templateInterpolated === false) return
                         if (['819'].includes(campaign_kind_id)) {
                             nameReport = `RINTRACCIO_PATRIMONIALE_GOLD_PG_${id_request}_${codiceFiscale}.pdf`;
                         } else {
                             nameReport = `PERSONA_GIURIDICA_DITTA_INDIVIDUALE_${id_request}_${codiceFiscale}.pdf`
                         }
                    }
                    break;
          }
          if (isControlCerved) {
               const now = moment(new Date()).format('DD/MM/YYYY HH:mm:ss');
               await pgConnection.query(setStateEntrustsAssignment(investigation_record_id, 'preparation', now))
               await pgConnection.query(setStateEntrustsRequest(id_request, 'entrusted', now))
               await pgConnection.query(setStateEntrusts(id_entrust, 'execution', now))
               console.log('il codice fiscale %s , con entrust %s é stato controllato e risulta ok', codiceFiscale, id_entrust)
               return
          }

          // Se l'oggetto è stato valorizzato
          if (Object.keys(jsonMapped).length) {

               let options;

               //blank item
               switch (customer_id.toString()) {
                    case '3387':
                         options = getOptions(await getHeader(process.env.SRC_HEADER as string, customer_id), await getFooter(process.env.SRC_FOOTER as string, customer_id), customer_id)                            
                         await insertJsonReportToCiro(pgConnection,jsonMapped.informazioneN,'CRIBIS',jsonMapped);          
                         break;
                    case '4902':
                         options = getOptions(await getHeader(process.env.SRC_HEADER_AZ as string, customer_id), await getFooter(process.env.SRC_FOOTER_AZ as string, customer_id), customer_id)
                         break;
                    case '4454':
                         options = getOptions(await getHeader(process.env.SRC_HEADER_BLANK as string, customer_id), await getFooter(process.env.SRC_FOOTER_BLANK as string, customer_id), customer_id)
                         await insertJsonReportToCiro(pgConnection,jsonMapped.informazioneN,'INAGEC',jsonMapped);          
                         break;
                    default:
                        options = getOptions(await getHeader(process.env.SRC_HEADER_BLANK as string, customer_id), await getFooter(process.env.SRC_FOOTER_BLANK as string, customer_id), customer_id)
               }
               /*               
                if (customer_id.toString().includes('3387')) {
                        options = getOptions(await getHeader(process.env.SRC_HEADER as string), await getFooter(process.env.SRC_FOOTER as string))
                } else {
                        options = getOptions(await getHeader(process.env.SRC_HEADER_BLANK as string), await getFooter(process.env.SRC_FOOTER_BLANK as string))
                }
               */
               // Converto il template in PDF
               let convertHtmlToPDF = await convertHtml2PDF(templateInterpolated, PATHFILE, nameReport as string, options);
               if (convertHtmlToPDF === false) return
               templateInterpolated = await addSommario(nameReport as string, PATHFILE, templateInterpolated, options);
               if (templateInterpolated === false) return

               //generazione visura
               
               const nameReportVisura = 'Visura_' + nameReport
               const pathFileVisura = PATHFILE + 'prospectHistory/'
               if (['714', '684', '698', '704', '875'].includes(campaign_kind_id) && legalFormSubject && (LegalFormSC.includes(legalFormSubject?.toLowerCase()) || LegalFormSP.includes(legalFormSubject?.toLowerCase()))) {
                    // Creazione e salvataggio del Prospetto Storico 
                    const jsonMappedProspectHistory = await prospettoStoricoConverter(codiceFiscale, codiciFiscaliAndCustomCode, productPurchaseResponse?.json, prospectHistoryResponse?.json, haveBilance)
                    const templateProspectHistory = await templateInterpolation<ICribisProspettoStorico>(process.env.SRC_PROSPETTO_STORICO as string, jsonMappedProspectHistory)
                    if (templateProspectHistory === false) return
                    let convertHtmlToPDF = await convertHtml2PDF(templateProspectHistory, pathFileVisura, nameReportVisura, options);
               }

               // Starto la transazione per il processo di salvataggio
               const transaction = await pgConnection.transaction();

               //elaborazione ed invio tramite sftp
               const res = await sendFileWithSFTP(nameReport,PATHFILE,author_id,id_request,transaction,pgConnection,sftp);
               if(res === false) return
               if (['714', '684', '698', '704', '875'].includes(campaign_kind_id) && (LegalFormSC.includes(legalFormSubject?.toLowerCase()) || LegalFormSP.includes(legalFormSubject?.toLowerCase()))) {
                    // Salvo le info del report su CIRO per salvataggio su SFTP
                    const res = await sendFileWithSFTP(nameReportVisura,pathFileVisura,author_id,id_request,transaction,pgConnection,sftp);
                    if(res === false) return
               }

               // Update campo 'state' DB
               await closeEntrustedAndEntrustedRequest(executionJob,transaction,pgConnection,investigation_record_id,id_request,id_entrust,campaign_kind_id,entrust_code)

               // Effettuo il commit della transaction
               await transaction.commit()
          }
          console.log('--- FINE PERSONA GIURIDICA')
     }
     catch (error) {
          console.log('---- ERROR: ', error)
          await executionJob.error((error as CustomError).message);
     }
}

async function verificaBilancio(balance: any, pgConnection: Sequelize, id_entrust: string, id_request: string, sftp: Client, codiceFiscale: string, investigation_record_id: string) {
     if (!(balance?.referenceYears?.length)) {
          const [resutEntrustId] = await pgConnection.query(generateQuerySelectAttachmentsByEntrustId(id_entrust,'bilanci.xls'))
          if (resutEntrustId && resutEntrustId[0]) {
               //const verify = await getCustomBilanci(sftp, (resutEntrustId[0] as any).id, codiceFiscale)
               const verify = await getCustomBilanciUnified(sftp, (resutEntrustId[0] as any).id, codiceFiscale)
               if (verify === false) {
                    return await sendEmailAndUpdate(codiceFiscale, id_entrust, investigation_record_id, pgConnection, id_request)
               }
               return verify;
          } else {
               return await sendEmailAndUpdate(codiceFiscale, id_entrust, investigation_record_id, pgConnection, id_request)
          }
     }
     return balance;
}

async function sendEmailAndUpdate(codiceFiscale: string, id_entrust: string, investigation_record_id: string, pgConnection: Sequelize, id_request: string) {
     console.log("non ho trovato alcun bilancio, invio email")
     await sendEmail(codiceFiscale, id_entrust)
     const now = moment(new Date()).format('DD/MM/YYYY HH:mm:ss');
     await pgConnection.query(setStateEntrustsRequest(id_request, 'entrusted', now))
     await pgConnection.query(setStateEntrustsAssignment(investigation_record_id, 'preparation', now))
     await pgConnection.query(setStateEntrusts(id_entrust, 'preparation', now))
     return false;
}