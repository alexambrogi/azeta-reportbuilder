import axios, { AxiosResponse } from "axios";
import CodiceFiscale from "codice-fiscale-js";
import fs from "fs/promises";
import Handlebars from "handlebars";
import html_to_pdf from "html-pdf-node";
import moment from "moment";
import mongoose from "mongoose";
import os from "os";
import { PDFDocumentProxy, getDocument } from 'pdfjs-dist';
import { TextItem } from "pdfjs-dist/types/src/display/api";
import { TextContent } from "pdfjs-dist/types/src/display/text_layer";
import { Sequelize, Transaction } from "sequelize";
import Client from 'ssh2-sftp-client';
import XLSX from 'xlsx';
import convert from 'xml-js';
import { extractBirthDay, extractPlaceOfBirth, extractProvinceOfBirth } from "./converter/persona-giuridica.converter";
import { BaseJointOwnerEntity, BaseJointOwnerModel } from "./database/mongodb/entity/baseJointOwner.entity";
import { IMainDocumentEntity, MainDocumentModel } from "./database/mongodb/entity/mainDocument.entity";
import { IProductPurchaseEntity, ProductPurchaseModel } from "./database/mongodb/entity/productPurchase.entity";
import { IProspectHistoryEntity, ProspectHistoryModel } from "./database/mongodb/entity/prospectHistory.entity";
import { RealEstateDataBaseEntity, RealEstateDataBaseModel } from "./database/mongodb/entity/realEstateDataBase.entity";
import { mongodbDisconnection } from "./database/mongodb/mongodb.connection";
import { postgresDisconnection } from "./database/postgres/postgres.connection";
import { generateQueryApprofondimentiIpotecari, generateQueryApprofondimentiIpotecariRapprLegale, generateQueryAttivitaLavorativa, generateQueryContiCorrenti, generateQueryEntrustsId, generateQueryErediAccettanti, generateQueryErediChiamati, generateQueryInsertAttachments, generateQueryInvestigationRecords, generateQueryLocazioniRecords, generateQueryLocazioniRappLegaliRecords, generateQueryLegaleRappresentante, generateQueryNoteConservatoriaByCodiceFiscale, generateQueryOperativitaSocieta, generateQueryPRA, generateQueryPRARapprLegal, generateQueryPensioni, generateQueryPersonaFisica, generateQueryPrejudical, generateQueryProprieta, generateQueryRapportiBancariLegaleRappresentante, generateQueryRecapitiTelefonici, generateQueryRecapitiTelefoniciRappresentati, generateQueryReperibilita, generateQuerySelectAttachments, generateQueryUpdateAttachments} from "./database/postgres/query/postgres.query";
import { Endpoint } from "./endpoint";
import { IBodyTemplateJson, ICervedBodyProductPurchase, IGetRequestFromJsonOptions } from "./models/cerved.model";
import { ExecutionJob } from "./models/logger.model";
import { AnagraficaPersonaFisica, ICribisPersonaFisica } from "./models/persona-fisica.model";
import { BalanceDetail, BalanceDetailWithColor, BankingRelationship, BankingRelationshipsLegalRepresentative, CompanyShareholding, ContoCorrente, Eredi, InvestigationRecords, Pra, RecapitiTelefonici, Veicolo, descriptionInsolvencyProceeding, descriptionPrejudicial, descriptionProtest } from "./models/persona-giuridica.model";
import { BalanceSheetExcel, ISftpOptions, InputDataCustomer, InputDataFromSFTP } from "./models/sftp.model";
import { erediService } from "./services/eredi.service";
import { personaFisicaService } from "./services/persona-fisica/persona-fisica.service";
import { personaGiuridicaService } from "./services/persona-giuridica/persona-giurdica.service";
import { request } from "http";
import { execSync } from "child_process";

const executionJob = new ExecutionJob();

export const PATHFILE = "src/pdf/";
/**
 * Classe per errore custom
 */
export class CustomError extends Error {
    status: number;
    name!: string;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
        this.message = this.message;
    }
}

/**
 * Questa funzione ritorna le configurazione per la generazione dei pdf
 */
export const getOptions = (header: string, footer: string, customer_id: string = ''): { [key: string]: any } => {
    var myMargin: { top: string; bottom: string; right: string; left: string } = {
        top: "200px",
        bottom: "100px",
        right: "30px",
        left: "30px",
    };
    
    if (customer_id.toString().includes('4902')) {
        myMargin = {
            top: "150px",
            bottom: "300px",
            right: "30px",
            left: "30px",
        };
    }
        
    return {
        format: "A4",
        timeout: 240000,
        displayHeaderFooter: true,
        headerTemplate: header,
        footerTemplate: footer,
        margin: myMargin,
        printBackground: true
    }
};

/**
 * Questa funzione ritorna il header per tutti i template
 */
export const getHeader = async (src: string, customer_id: string = '') => {
    const base64ImageHeader = await fs.readFile(src, "base64");
    let numberWidth = 200;
    let numberHeight = 57;
    
    if (customer_id.toString().includes('4902')) 
    {
        numberWidth = 90;
        numberHeight = 90;
        return `<img src="data:image/png;base64,${base64ImageHeader}" class="imageHeader" style="padding-left: 45px; padding-bottom: 140px; width: ${numberWidth}px; height: ${numberHeight}px;">`;

    }

    if (os.type().toLocaleLowerCase() === 'linux') {
        let molt = 1.35;
        numberWidth = numberWidth * molt;
        numberHeight = numberHeight * molt;
    }
   return `<img src="data:image/png;base64,${base64ImageHeader}" class="imageHeader" style="padding-left: 45px; padding-bottom: 140px; width: ${numberWidth}px; height: ${numberHeight}px;">`;
};

/**
 * Questa funzione ritorna il footer per tutti i template
 */
export const getFooter = async (src: string, customer_id: string = '') => {
    const base64ImageFooter = await fs.readFile(src, "base64");
    const cssFooter = `<style> .container {display: flex; justify-content: end; align-items: flex-end; width: 100%; padding-right: 5px; margin-top: 140px} .innerContainer {display: flex; justify-content: end; align-items: end; width: fit-content; gap: 3px} .boxNumber {width: 14px; height: 14px; background: #023671; -webkit-print-color-adjust: exact; display: flex; justify-content: center; align-items: center; border-radius: 50%; padding: 5px; margin-bottom: 8px} .boxNumber > h1 {font-size: 8px;color: #fff; } </style>`;
    let numberWidth = 531;
    let numberHeight = 58;
    
    if (customer_id.toString().includes('4902')) 
    {
        //numberHeight = 1380;
        numberHeight = 208;
        return cssFooter + `<div class="container" > 
                            <div class="innerContainer" > 
                                <img src="data:image/png;base64,${base64ImageFooter}" style="width: ${numberWidth}px; height: ${numberHeight}px;"/> 
                                <div class="boxNumber"> 
                                    <h1 class="pageNumber"> </h1> 
                                </div> 
                            </div>
                        </div>
                        `;        
    }
        
    if (os.type().toLocaleLowerCase() === 'linux') {
        let molt = 1.35;
        numberWidth = numberWidth * molt;
        numberHeight = numberHeight * molt;
    }
    return cssFooter + `<div class="container" > 
                            <div class="innerContainer" > 
                                <img src="data:image/png;base64,${base64ImageFooter}" style="width: ${numberWidth}px; height: ${numberHeight}px;"/> 
                                <div class="boxNumber"> 
                                    <h1 class="pageNumber"> </h1> 
                                </div> 
                            </div>
                        </div>
                        `;
};

export const socialCapitalOptions = { style: 'currency', currency: "EUR" } as Intl.NumberFormatOptions;

export const wordsToReplaceVehicles = ["DATA PRIMA IMMATRICOLAZIONE: ", 'TARGATA', 'Telaio', 'Ruolo soggetto', 'Fabbrica', 'Modello', 'TARGATO'];

export const wordsToReplaceInvestigation = ['DENOMINAZIONE', 'CODICE FISCALE', 'INDIRIZZO', 'DATA INIZIO', 'TIPOLOGIA LOCAZIONE', 'CANONE ANNUO', 'DATA INIZIO', 'CONTROPARTE']

/**
 * Questa funzione prende fa una richiesta a cerved, lo converte in XML e successivamente in json. E' possibile aggiungere delle options.
 * Esempio di options : { format : true, request_id : true }. In questo caso ritorna oltre al json anche le info riguardo il request_id ed il format
 * Se non vengono inserite delle options ritorna sempre un oggetto con dentro json
 */
export const getJsonFromRequest = async <R>(response: any, options?: IGetRequestFromJsonOptions): Promise<IBodyTemplateJson<R>> => {
    try {
        const xml = Buffer.from(response.data.content as any, 'base64').toString();
        const json = JSON.parse(convert.xml2json(xml, { compact: true, spaces: 4 })) as R;
        let objectToReturn = { json } as IBodyTemplateJson<R>
        if (!!options) {
            Object.keys(options).forEach(key => {
                if (options[key as keyof IGetRequestFromJsonOptions]) {
                    objectToReturn[key as keyof IBodyTemplateJson<R>] = response.data[key]
                }
            });
        }
        return objectToReturn;
    }
    catch (error) {
        await executionJob.error((error as CustomError).message);
        console.error('----- ERROR: ', error)
        return {
            json: {} as R
        }
    }
}

/**
 * Questa funzione converte un template in pdf
 */
export const convertHtml2PDF = async (template: string, pathFile: string, filename: string, options: { [key: string]: any }) => {
    try {
        let file = { content: template };
        const pdf = (await html_to_pdf.generatePdf(file, options) as any) as Buffer;
        const dest = `${pathFile}1-`;
        await fs.writeFile(dest + filename, pdf);
    }
    catch (error) {
        console.error(error);
        await executionJob.error((error as CustomError).message);
        return false
    }
}

/**
 * Questa funzione prende il template e fa l'iterpolazione
 */
export const templateInterpolation = async <T>(src: string, jsonMapped: T): Promise<string | false> => {
    try {
        Handlebars.registerHelper({
            eq: (v1, v2) => v1 === v2,
            ne: (v1, v2) => v1 !== v2,
            lt: (v1, v2) => v1 < v2,
            gt: (v1, v2) => v1 > v2,
            lte: (v1, v2) => v1 <= v2,
            gte: (v1, v2) => v1 >= v2,
            endArray: (v1, v2) => v1 === (v2 - 1),
            add: (v1, v2) => v1 + v2,
            and() {
                return Array.prototype.every.call(arguments, Boolean);
            },
            or() {
                return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
            },
            math(lvalue, operator, rvalue, options) {
                lvalue = parseFloat(lvalue);
                rvalue = parseFloat(rvalue);
                switch (operator) {
                    case "+":
                        return lvalue + rvalue
                    case "-":
                        return lvalue - rvalue
                    case "*":
                        return lvalue * rvalue
                    case "/":
                        return lvalue / rvalue
                    case "%":
                        return lvalue % rvalue

                }
            },
            json(value) {
                return JSON.stringify(value)
            }
        });
        const source = await fs.readFile(src, 'utf8')
        const template = Handlebars.compile(source);
        return template(jsonMapped);
    }
    catch (error) {
        console.error('Errore durante la ricerca documento su Mongo:', error);
        await executionJob.error((error as CustomError).message);
        return false
    }
}

/**
    Questa funzione recupera le info del file appena salvato nella cartella PDF e persiste le informazioni su CIRO
 */
export const saveFileCiro = async (nameFile: string, pgConnection: Sequelize, customer_id: string, entrust_request_id: string, basePath: string, transaction: Transaction) => {
    try {
        let ghostScript = 'gs'
        if (os.type().toLocaleLowerCase() !== 'linux') {
            ghostScript = '"C:/Program Files/gs/gs10.06.0/bin/gswin64.exe"'
        }

        if (nameFile.includes('pdf')) {
            try {
                await execSync(
                    `${ghostScript} -q -dNOPAUSE -dBATCH -dSAFER -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/screen -dEmbedAllFonts=true -dSubsetFonts=true -dColorImageDownsampleType=/Bicubic -dColorImageResolution=144 -dGrayImageDownsampleType=/Bicubic -dGrayImageResolution=144 -dMonoImageDownsampleType=/Bicubic -dMonoImageResolution=144 -sOutputFile=${basePath}${nameFile} ${basePath}1-${nameFile}`);
            } catch (exce) {
                console.error("si e verificato l'[errore]", exce)
                return false
            }
        }
        const [resutEntrustId] = await pgConnection.query(generateQueryEntrustsId(entrust_request_id))
        const statsFile = await fs.stat(`${basePath}${nameFile}`)
        // let [idOfAttachments, metadata] = await pgConnection.query(generateQuerySelectAttachments(nameFile))
        let createOrUpdate = {
            file_file_name: nameFile,
            file_content_type: 'application/pdf',
            file_file_size: statsFile.size.toString(),
            file_updated_at: moment(new Date()).format("DD/MM/YYYY HH:mm:ss"),
            user_id: customer_id,
            uploaded_at: moment(new Date()).format("DD/MM/YYYY HH:mm:ss"),
            entrust_id: (resutEntrustId[0] as { id: string }).id,
            created_at: moment(new Date()).format("DD/MM/YYYY HH:mm:ss"),
            updated_at: moment(new Date()).format("DD/MM/YYYY HH:mm:ss"),
        };
        // if (idOfAttachments.length === 0) {
        const [result, metadata] = await pgConnection.query(generateQueryInsertAttachments(
            createOrUpdate),
            {
                raw: true
            }
        )
        return result
        // } 
        // else {
        //     const [result, metdata] = await pgConnection.query(generateQueryUpdateAttachments(createOrUpdate, idOfAttachments[0]),
        //         {
        //             raw: true
        //         }
        //     )
        // }
        // return idOfAttachments
    } catch (error) {
        console.error(error)
        await transaction.rollback() //rollback di CIRO
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

export const addSommario = async (nameFile: string, pathfile: string, templateInterpolated: string, option: { [key: string]: any }) => {
    try {

        const pdfPath = `${PATHFILE}1-` + nameFile;
        var pdf = getDocument(pdfPath).promise;
        let mappaIndici = await pdf.then(async function (pdf: any) {

            const numPages = pdf.numPages;
            let tocPageNum = await getTocPageNumber(pdf, numPages, 'Conten');
            if (tocPageNum === false) return;
            let tocPagLeg = await getTocPageNumber(pdf, numPages, 'Legale rappresentante');
            const tocPage = await pdf.getPage(tocPageNum);
            const tocTextContent = await tocPage.getTextContent();
            let tocItems = extractTocItems(tocTextContent, "::");
            if (tocPagLeg) {
                const tocPage = await pdf.getPage(tocPagLeg);
                const tocTextContent = await tocPage.getTextContent();
                tocItems = tocItems.concat(extractTocItems(tocTextContent, ";;"));
            }

            return createPageMapping(pdf, tocItems, numPages, tocPageNum);
        });
        console.log(mappaIndici)
        if (mappaIndici) {
            for (var entry of mappaIndici.entries()) {
                while (entry[0].includes(" "))
                    entry[0] = entry[0].replace(" ", "_");
                if (entry[0].substring(entry[0].length - 1).includes("_"))
                    entry[0] = entry[0].substring(0, entry[0].length - 1);
                let numeroIndiceAttuale = templateInterpolated.indexOf(entry[0]);
                let lunghezzaAggiunta = 0;
                let formula = templateInterpolated.substring(numeroIndiceAttuale, numeroIndiceAttuale + entry[0].length + lunghezzaAggiunta + 1);
                while (!formula.includes("\<")) {
                    lunghezzaAggiunta = lunghezzaAggiunta + 1;
                    formula = templateInterpolated.substring(numeroIndiceAttuale, numeroIndiceAttuale + entry[0].length + lunghezzaAggiunta + 1);
                }
                entry[0] = formula.substring(0, formula.length - 1);
                if (templateInterpolated.includes("style=\"display:none\">" + entry[0])) {
                    templateInterpolated = templateInterpolated.replace("style=\"display:none\">" + entry[0], ">" + entry[1].toString());
                }

                while (entry[0].includes("_"))
                    entry[0] = entry[0].replace("_", " ");
                if (templateInterpolated.includes(entry[0].substring(1))) {
                    templateInterpolated = templateInterpolated.replace(entry[0].substring(1), entry[0].substring(2))
                } else {
                    if (entry[0].includes("ANAGRAFICA")) {
                        templateInterpolated = templateInterpolated.replace(":ANAGRAFICA", "ANAGRAFICA")
                        templateInterpolated = templateInterpolated.replace(":ANAGRAFICA IMPRESA", "ANAGRAFICA IMPRESA")
                    }
                    else if (entry[0].includes("REPERIBILITA' LEGALE RAPPRESENTANTE")) {
                        templateInterpolated = templateInterpolated.replace(":LEGALE RAPPRESENTANTE", "LEGALE RAPPRESENTANTE")
                    }
                }
            }
        }
        while (templateInterpolated.includes("A'"))
            templateInterpolated = templateInterpolated.replace("A'", "Á")
        let convertHtmlToPDF = await convertHtml2PDF(templateInterpolated, pathfile, nameFile as string, option)
        return templateInterpolated
    } catch (error) {
        console.error(error);
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

async function getTocPageNumber(pdf: PDFDocumentProxy, numPages: number, type: string, tocPageNum?: number) {
    for (let i = (tocPageNum ? tocPageNum + 1 : 1); i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const pageTextContent = await page.getTextContent();
        if (pageTextContent.items.some((el: any) => ((el as TextItem).str).toLowerCase().includes(type.toLowerCase()))) {
            return i;
        }
    }
    return false;
}

function extractTocItems(tocTextContent: TextContent, placeHolder: string) {
    const items = [];
    for (const item of tocTextContent.items) {
        // Estrai il testo della voce del sommario (es. "Introduzione")
        let title = (item as TextItem).str;
        if (title.length < 5)
            continue
        if (title.length > 50)
            title = title.substring(0, 50);
        while (title.includes("_"))
            title = title.replace("_", " ");
        if (title.includes("ANAGRAFICA IMPRESA"))
            title = "ANAGRAFICA"
        items.push(placeHolder + title);

    }
    return items;
}

// Funzione per mappare le voci del sommario alle pagine
async function createPageMapping(pdf: PDFDocumentProxy, tocItems: string[], numPages: number, numSommario: number) {
    const mapping = new Map<string, number>();
    for (const item of tocItems) {
        for (let i = numSommario; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const pageTextContent = await page.getTextContent();
            // Verifica se il titolo della voce del sommario è presente nella pagina
            if (pageTextContent.items.some((el: any) => (":" + (el as TextItem).str).toLowerCase().includes(item.toLowerCase())) || pageTextContent.items.some((el: any) => (";" + (el as TextItem).str).toLowerCase().includes(item.toLowerCase()))) {
                mapping.set(item, page.pageNumber);
                break;
            }
            else if (item.toLowerCase().includes("::REPERIBILITA'".toLowerCase()) && pageTextContent.items.some((el: any) => (":" + (el as TextItem).str).toLowerCase().includes("::LEGALE RAPPRESENTANTE".toLowerCase()))) {
                console.error("sono nel elseif", item)
                mapping.set(item, page.pageNumber);
                break;
            }
        }
    }
    return mapping;
}
/**
    Questa funzione recupera le info dalla chiamata appena effettuata e persiste le informazioni su MONGODB - Persona Giuridica
 */
export const saveProductPurchaseMongo = async (idRequest: string, codiceFiscale: string, dateOfRequest: string, investigation_record_id: string, productPurchaseResponse: Object, originalBody: any, request_id?: string) => {
    try {
        const productPurchaseData = {
            idRequest: idRequest,
            codiceFiscale: codiceFiscale,
            dateOfRequest: dateOfRequest,
            investigation_record_id: investigation_record_id,
            productPurchaseResponse: productPurchaseResponse,
            originalBody: originalBody,
            request_id: request_id
        } as IProductPurchaseEntity

        await ProductPurchaseModel.insertMany([productPurchaseData]).then(result => {
            console.log("Dati prodotto inseriti su mongo: ", result)
        })

    } catch (error) {
        console.error('Errore durante il salvataggio prodotto su Mongo:', error);

    }
};

/**
Questa funzione controlla se sono presenti dati sul db oppure li prende dalla chiamata esterna - Persona Giuridica
    result body se viene trovato dal servizio
    result true se é un noRea
    result false se é un errore reale
*/
export const findProductPurchaseMongo = async (idRequest: string, codiceFiscale: string, dateOfRequest: string, investigation_record_id: string) => {
    try {
        return await ProductPurchaseModel.findOne({ codiceFiscale: codiceFiscale }).then(async result => {
            if (result) {
                console.log("Dati Prodotto recuperati da mongo: ", result)
                return result.productPurchaseResponse
            } else {
                //PROD
                const productPurchaseBody = { format: "XML", product_id: 52306, subject_type: "COMPANY", vat_number: codiceFiscale, language: "ITALIAN" } as ICervedBodyProductPurchase;
                console.log("body della chiamata su product purchase productPurchaseBody", JSON.stringify(productPurchaseBody));
                const responseProductPurchase = await axios.post(Endpoint.productPurchase(), productPurchaseBody, { headers: { 'apiKey': process.env.API_KEY } }) as AxiosResponse;
                const request_id = responseProductPurchase?.data?.request_id ? responseProductPurchase?.data?.request_id?.toString() || '' : ''
                console.log("REQUEST_ID responseProductPurchase [CERVED]", request_id)
                console.log(responseProductPurchase)
                const { format, ...productPurchaseResponse } = await getJsonFromRequest<{ [key: string]: any }>(responseProductPurchase);
                if (!(responseProductPurchase?.data?.detailed_delivery_status?.includes('RICHIESTA EVASA'))) {
                    codiceFiscale = codiceFiscale + '_ERR'
                    console.log('errore nella chiamata con risposta 200', responseProductPurchase?.data?.detailed_delivery_status || '')
                    saveProductPurchaseMongo(idRequest, codiceFiscale, dateOfRequest, investigation_record_id, productPurchaseResponse, {}, request_id)
                    return false
                } else {
                    saveProductPurchaseMongo(idRequest, codiceFiscale, dateOfRequest, investigation_record_id, productPurchaseResponse, {}, request_id)
                }
                return { ...productPurchaseResponse, request_id }
            }
        })
            .catch(err => {
                console.error("non siamo riusciti a raggiungere l'url", JSON.stringify({ key: Endpoint.productPurchase() }))
                console.error("ERRORE: %s , STATUS: %s", JSON.stringify(err), err?.response?.status?.toString())
                if (err?.response?.status?.toString() === '404' || err.response.status.toString() === '422') {
                    console.error("sono [true] per l'errore: ", err)
                    return true
                }
                else {
                    return false
                }
            })
    } catch (error) {
        console.error('Errore durante la ricerca prodotto su Mongo:', error);
        return false

    }
};



/**
Questa funzione recupera le info dalla chiamata prospectHistory appena effettuata e persiste le informazioni su MONGODB - persona giuridica
*/
export const saveProspectHistoryMongo = async (idRequest: string, codiceFiscale: string, dateOfRequest: string, investigation_record_id: string, prospectHistory: Object, originalBody: any, request_id2: string) => {
    try {
        const prospectHistoryData = {
            idRequest: idRequest,
            codiceFiscale: codiceFiscale,
            dateOfRequest: dateOfRequest,
            investigation_record_id: investigation_record_id,
            prospectHistoryResponse: prospectHistory,
            originalBody: originalBody,
            request_id: request_id2
        } as IProspectHistoryEntity

        await ProspectHistoryModel.insertMany([prospectHistoryData]).then(result => {
            console.log("Dati Prospetto storico inseriti su mongo: ", result)
        })

    } catch (error) {
        console.error('Errore durante il salvataggio del prospetto storico su mongo:', error);

    }
};


/**
Questa funzione controlla se sono presenti dati sul db oppure li prende dalla chiamata esterna - Persona Giuridica
*/
export const findProspectHistoryMongo = async (idRequest: string, codiceFiscale: string, dateOfRequest: string, investigation_record_id: string, request_id: string) => {
    try {
        return await ProspectHistoryModel.findOne({ codiceFiscale: codiceFiscale }).then(async result => {
            if (result) {
                console.log("Dati Prospetto Storico recuperati da mongo: ", result)
                return result.prospectHistoryResponse
            } else {
                const prospectHistoryBody = { request_id, language: process.env.CERVED_LANGUAGE_REQUEST, format: 'XML', accessory_document_type: process.env.CERVED_ACCESSORY_DOCUMENT_TYPE };
                console.log("body della chiamata su prospect history prospectHistoryBody", JSON.stringify(prospectHistoryBody));
                const responseProspectHistory = await axios.post(Endpoint.prospectHistory(), prospectHistoryBody, { headers: { 'apiKey': process.env.API_KEY } }) as AxiosResponse;
                console.log(responseProspectHistory)
                const request_id2 = responseProspectHistory?.data?.request_id ? responseProspectHistory?.data?.request_id?.toString() || '' : ''
                console.log("REQUEST_ID prospectHistoryBody [CERVED]", request_id2)
                console.log(responseProspectHistory)
                const prospectHistoryResponse = await getJsonFromRequest<{ [key: string]: any }>(responseProspectHistory);
                saveProspectHistoryMongo(idRequest, codiceFiscale, dateOfRequest, investigation_record_id, prospectHistoryResponse, {}, request_id2)
                return { ...prospectHistoryResponse }
            }
        })
            .catch(err => {
                console.error("non siamo riusciti a raggiungere l'url", JSON.stringify({ key: Endpoint.prospectHistory(), value: err }))
                console.error("ERRORE: ", JSON.stringify(err))
                return false
            })
    } catch (error) {
        console.error('Errore durante la ricerca del prospetto storico su Mongo', error);
        return false

    }
};



/**
Questa funzione recupera le info dalla chiamata appena effettuata e persiste le informazioni su MONGODB - persona fisica
*/
export const saveMainDocumentMongo = async (codiceFiscale: string, dateOfRequest: string, investigation_record_id: string, mainDocumentResponse: Object, originalBody: any, id_request: string, idRequest?: string, id_request_main?: string, originalBodyProduct?: any) => {
    try {
        const mainDocumentData = {
            idRequest: idRequest || '',
            codiceFiscale: codiceFiscale,
            dateOfRequest: dateOfRequest,
            investigation_record_id: investigation_record_id,
            mainDocumentResponse: mainDocumentResponse,
            originalBodyProduct: originalBodyProduct || '',
            originalBody: originalBody,
            id_request_Product: id_request,
            id_request_Main: id_request_main || ''
        } as IMainDocumentEntity
        await MainDocumentModel.insertMany([mainDocumentData]).then(result => {
            console.log("dati persona fisica inseriti su mongo: ", result)
        })
    } catch (error) {
        console.error('Errore durante il salvataggio documento su Mongo:', error);

    }
};

/**
Questa funzione controlla se sono presenti dati sul db oppure li prende dalla chiamata esterna - Persona fisica
*/
export const findMainDocumentMongoReportImprenditore = async (idRequest: string, codiceFiscale: string, dateOfRequest: string, investigation_record_id: string) => {
    try {
        return await MainDocumentModel.findOne({ codiceFiscale: codiceFiscale }).then(async result => {
            if (result) {
                console.log("Dati documento recuperati da mongo: ", result)
                return result.mainDocumentResponse
            } else {
                const productPurchaseBody = { tax_code: codiceFiscale, format: "XML", product_id: 52331, subject_type: "PERSON", language: "ITALIAN" } as ICervedBodyProductPurchase;
                console.log("body della chiamata su product purchase productPurchaseBody", JSON.stringify(productPurchaseBody));
                const responseProductPurchase = await axios.post(Endpoint.productPurchase(), productPurchaseBody, { headers: { 'apiKey': process.env.API_KEY } }) as AxiosResponse;
                const idRequestForFindProduct = responseProductPurchase?.data?.request_id ? responseProductPurchase?.data?.request_id?.toString() || '' : ''
                console.log("REQUEST_ID responseProductPurchase [CERVED]", idRequestForFindProduct)
                console.log(responseProductPurchase)
                saveProductPurchaseMongo(idRequest, codiceFiscale, dateOfRequest, investigation_record_id, responseProductPurchase, idRequestForFindProduct)
                const responseMainDocument = await axios.get(Endpoint.MainDocumentRetrieve(idRequestForFindProduct, 'XML'), { headers: { 'apiKey': process.env.API_KEY } }) as AxiosResponse;
                const { request_id, format, ...productPurchaseResponse } = await getJsonFromRequest<{ [key: string]: any }>(responseMainDocument);
                const request_idSTR = request_id?.toString() || ''
                console.log("REQUEST_ID responseMainDocument [CERVED]", request_idSTR)
                console.log(responseMainDocument)
                saveMainDocumentMongo(codiceFiscale, dateOfRequest, investigation_record_id, productPurchaseResponse, {}, idRequestForFindProduct, idRequest, request_idSTR, {});
                return { ...productPurchaseResponse }
            }
        })
            .catch(err => {
                console.error("non siamo riusciti a raggiungere l'url", JSON.stringify({ key: Endpoint.productPurchase(), key2: Endpoint.MainDocumentRetrieve("?", 'XML'), value: err }))
                console.error("ERRORE: ", JSON.stringify(err))
                return false
            })
    } catch (error) {
        console.error('Errore durante la ricerca documento su Mongo:', error);
        await executionJob.error((error as CustomError).message);
        return false
    }
};

export const findMainDocumentMongoPersonaFisica = async (idRequest: string, codiceFiscale: string, dateOfRequest: string, investigation_record_id: string) => {
    try {
        return await MainDocumentModel.findOne({ codiceFiscale: codiceFiscale }).then(async result => {
            if (result) {
                console.log("Dati documento recuperati da mongo: ", result)
                return result.mainDocumentResponse
            } else {
                const productPurchaseBody = { tax_code: codiceFiscale, format: "XML", product_id: 52333, subject_type: "PERSON", language: "ITALIAN" } as ICervedBodyProductPurchase;
                console.log("body della chiamata su product purchase productPurchaseBody", JSON.stringify(productPurchaseBody));
                const responseProductPurchase = await axios.post(Endpoint.productPurchase(), productPurchaseBody, { headers: { 'apiKey': process.env.API_KEY } }) as AxiosResponse;
                const idRequestForFindProduct = responseProductPurchase?.data?.request_id ? responseProductPurchase?.data?.request_id?.toString() || '' : ''
                console.log("REQUEST_ID responseProductPurchase [CERVED]", idRequestForFindProduct)
                console.log(responseProductPurchase)
                saveProductPurchaseMongo(idRequest, codiceFiscale, dateOfRequest, investigation_record_id, responseProductPurchase, idRequestForFindProduct)
                const responseMainDocument = await axios.get(Endpoint.MainDocumentRetrieve(idRequestForFindProduct, 'XML'), { headers: { 'apiKey': process.env.API_KEY } }) as AxiosResponse;
                const { request_id, format, ...productPurchaseResponse } = await getJsonFromRequest<{ [key: string]: any }>(responseMainDocument);
                const request_idSTR = request_id?.toString() || ''
                console.log("REQUEST_ID responseMainDocument [CERVED]", request_idSTR)
                console.log(responseMainDocument)
                saveMainDocumentMongo(codiceFiscale, dateOfRequest, investigation_record_id, productPurchaseResponse, {}, idRequestForFindProduct, idRequest, request_idSTR, {});
                return { ...productPurchaseResponse }
            }
        })
            .catch(err => {
                console.error("non siamo riusciti a raggiungere l'url", JSON.stringify({ key: Endpoint.productPurchase(), key2: Endpoint.MainDocumentRetrieve("?", 'XML'), value: err }))
                console.error("ERRORE: ", JSON.stringify(err))
                return false
            })
    } catch (error) {
        console.error('Errore durante la ricerca documento su Mongo:', error);
        await executionJob.error((error as CustomError).message);
        return false
    }
};

/**
Questa funzione controlla se sono presenti dati sul db oppure li prende dalla chiamata esterna - Persona Fisica (rappresentante legale)
*/
export const findLegalRepresentative = async (codiceFiscale: string, dateOfRequest: string, investigation_record_id: string) => {
    try {
        return await MainDocumentModel.findOne({ codiceFiscale: codiceFiscale }).then(async result => {
            if (result) {
                console.log("Dati Rappresentante legale recuperati da mongo: ", result)
                return result.mainDocumentResponse
            } else {
                const productPurchaseBody = { tax_code: codiceFiscale, format: "XML", product_id: 52331, subject_type: "PERSON", language: "ITALIAN" } as ICervedBodyProductPurchase;
                console.log("body della chiamata su product purchase productPurchaseBody", JSON.stringify(productPurchaseBody));
                const responseProductPurchase = await axios.post(Endpoint.productPurchase(), productPurchaseBody, { headers: { 'apiKey': process.env.API_KEY } }) as AxiosResponse;
                const request_id = responseProductPurchase?.data?.request_id ? responseProductPurchase?.data?.request_id?.toString() || '' : '';
                console.log("REQUEST_ID responseProductPurchase [CERVED]", request_id)
                console.log(responseProductPurchase)
                const responsePersonaFisica = await getJsonFromRequest<ICribisPersonaFisica>(responseProductPurchase) as any;
                saveMainDocumentMongo(codiceFiscale, dateOfRequest, investigation_record_id, responsePersonaFisica, {}, request_id);
                return { ...responsePersonaFisica }
            }
        }).catch(err => {
            console.error("non siamo riusciti a raggiungere l'url", JSON.stringify({ key: Endpoint.productPurchase() }))
            console.error("ERRORE: ", JSON.stringify(err))
            return err
        })
    } catch (error) {
        console.error('Errore durante la ricerca prodotto su Mongo:', error);
        return error
    }
};

/**
Questa funzione controlla se sono presenti dati sul db oppure li prende dalla chiamata esterna - Catasto Base (sezione immobiliare)
*/
export const findRealEstateData = async (codiceFiscale: string, isEstimate: boolean) => {
    try {
        return await RealEstateDataBaseModel.findOne({ codiceFiscale, isEstimate }).then(async result => {
            if (result) {
                console.log("Dati Castato recuperati da mongo: ", result)
                return result.data
            } else {
                console.log("body della chiamata su find real estate data", JSON.stringify({ codiceFiscale: codiceFiscale, isEstimate: isEstimate }));
                if (isEstimate) {
                    const data = await axios.get(Endpoint.estimationBuilding(codiceFiscale), { headers: { 'apiKey': process.env.API_KEY } }) as AxiosResponse;
                    console.log("REQUEST_ID findRealResponse [CERVED]", data.data?.request_id)
                    console.log(data)
                    saveRealEstateDataMongo(codiceFiscale, data.data, isEstimate, {}, data.data?.request_id?.toString() || '');
                    return data.data
                } else {
                    const data = await axios.get(Endpoint.realEstateDataBase(codiceFiscale), { headers: { 'apiKey': process.env.API_KEY } }) as AxiosResponse;
                    console.log("REQUEST_ID findRealResponse [CERVED]", data.data?.request_id)
                    console.log(data)
                    saveRealEstateDataMongo(codiceFiscale, data.data, isEstimate, {}, data.data?.request_id?.toString() || '');
                    return data.data
                }
            }
        }).catch(err => {
            console.error("non siamo riusciti a raggiungere l'url", JSON.stringify({ key: Endpoint.estimationBuilding(codiceFiscale), value: err }))
            console.error("ERRORE: ", JSON.stringify(err))
            return err
        })
    } catch (error) {
        console.error('Errore durante la ricerca catasto su Mongo:', error);
        return error
    }
};

/**
Questa funzione recupera le info dalla chiamata appena effettuata e persiste le informazioni su MONGODB - Catasto Base
*/
export const saveRealEstateDataMongo = async (codiceFiscale: string, data: Object, isEstimate: boolean, originalBody: any, request_id: string) => {
    try {
        const documentData = {
            codiceFiscale: codiceFiscale,
            data,
            isEstimate,
            originalBody: originalBody,
            request_id: request_id
        } as RealEstateDataBaseEntity
        await RealEstateDataBaseModel.insertMany([documentData]).then(result => {
            console.log("dati Catasto inseriti su mongo: ", result)
        })
    } catch (error) {
        console.error('Errore durante il salvataggio Catasto su Mongo:', error);

    }
};

/**
Questa funzione controlla se sono presenti dati sul db oppure li prende dalla chiamata esterna - Cointestatari Terreni/Fabbricati (sezione immobiliare)
*/
export const findJointOwner = async (dataRequest: any, type: string, codiceFiscale: string) => {
    try {
        return await BaseJointOwnerModel.findOne({ codiceFiscale: codiceFiscale }).then(async result => {
//            if (result) {
//                console.log("Dati Cointestatari recuperati da mongo: ", result)
//                return result.data
//            } else {
                console.log("body della chiamata su find joint owner", JSON.stringify({ dataRequest: dataRequest, type: type }));
                if (type === 'build') {
                    const data = await axios.post(Endpoint.baseJointOwnerBuilding(), dataRequest, { headers: { 'apiKey': process.env.API_KEY } }) as AxiosResponse;
                    console.log("REQUEST_ID findJointResponse [CERVED]", data.data?.request_id)
                    console.log(data)
                    saveBaseJointOwnerMongo(codiceFiscale, data.data, type, {}, data.data?.request_id?.toString() || '');
                    return data.data
                } else {
                    const data = await axios.post(Endpoint.baseJointOwnerLand(), dataRequest, { headers: { 'apiKey': process.env.API_KEY } }) as AxiosResponse;
                    console.log("REQUEST_ID findJointResponse [CERVED]", data.data?.request_id)
                    console.log(data)
                    saveBaseJointOwnerMongo(codiceFiscale, data.data, type, {}, data.data?.request_id?.toString() || '');
                    return data.data
                }
  //          }
        }).catch(err => {
            console.error("non siamo riusciti a raggiungere l'url", JSON.stringify({ key: type === 'build' ? Endpoint.baseJointOwnerBuilding() : Endpoint.baseJointOwnerLand(), value: err }))
            console.error("ERRORE: ", JSON.stringify(err))
            return false
        })
    } catch (error) {
        console.error('Errore durante la ricerca Cointestatari su Mongo:', error);
        return false
    }
};

/**
Questa funzione recupera le info dalla chiamata appena effettuata e persiste le informazioni su MONGODB - Cointestatari Terreni/Fabbricati
*/
export const saveBaseJointOwnerMongo = async (codiceFiscale: string, data: Object, type: string, originalBody: any, request_id: any) => {
    try {
        const documentData = {
            codiceFiscale: codiceFiscale,
            data,
            type,
            request_id: request_id,
            originalBody: originalBody
        } as BaseJointOwnerEntity
        await BaseJointOwnerModel.insertMany([documentData]).then(result => {
            console.log("dati Cointestatari inseriti su mongo: ", result)
        })
    } catch (error) {
        console.error('Errore durante il salvataggio Cointestatari su Mongo:', error);

    }
};

/**
 * Questa funzione stabilisce la connessione al server sftp
 */
export const sftpConnection = async (sftp: Client, options: ISftpOptions) => {
    try {
        return await sftp.connect({
            host: options.host,
            port: parseInt(options.port),
            username: options.user,
            password: options.password
        }) as any;
    }
    catch (error) {
        console.error(error);
        throw new CustomError(500, 'Something went wrong with sftp connection');
    }
}
/**
 * Questa funzione permette il trasferimento di un file sul server sftp
 */
export const sftpTransferFile = async (sftp: Client, localSrc: string, remoteSrc: string, transaction: Transaction) => {
    try {
        return await sftp.put(localSrc, remoteSrc);
    }
    catch (error) {
        console.error(error);
        await transaction.rollback() //rollback di CIRO
        // throw new CustomError(500, 'Something went wrong with file transfer on sftp')
        await executionJob.error((error as CustomError).message);
        return false
    }
}
/**
 * Questa funzione permette di creare folder sul server sftp
 */
export const sftpCreateFolder = async (sftp: Client, idOfAttachments: string, transaction: Transaction) => {
    try {
        const arrayPartsOfIdAttchament = generateIdAttachments(idOfAttachments)
        const partsOfBasePath = `/opt/enbilab/webapps/ciro_web/shared/private/system/attachments/files/${arrayPartsOfIdAttchament.join("/")}/original`;
        // const partsOfBasePath = `/opt/enbilab/webapps/ciro_web/shared/public/system/attachments/files/000/${partsOfPath.join("/")}/original`;
        await sftp.mkdir(partsOfBasePath, true);
        return partsOfBasePath
    }
    catch (error) {
        console.error(error);
        await transaction.rollback() //rollback di CIRO
        await executionJob.error((error as CustomError).message);
        return false
    }
}

/**
 * Questa funzione legge l'excel con i dati in input dal server sftp
 */
export const getCustomerInput = async (sftp: Client, id_request: string) => {
    try {
        //genero il path dinamico del file
        let partsOfPath = [];
        for (let i = 0; i < id_request.length; i += 3) {
            partsOfPath.push(id_request.substring(i, i + 3));
        }
        //ottengo il nome del file da estrarre
        const files = await sftp.list(`${process.env.BASE_PATH_REQUEST_DATA_INPUT}${partsOfPath.join("/")}/original/`)
        const nameFile = files[0].name
        //estraggo e converto in json il file
        const file = await sftp.get(`${process.env.BASE_PATH_REQUEST_DATA_INPUT}${partsOfPath.join("/")}/original/${nameFile}`)
        const workbook = XLSX.read(file, { type: 'buffer' });
        const workSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[workSheetName];
        const data: InputDataFromSFTP[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        let inputData: InputDataCustomer = {}
        if (data.length) {
            inputData = {
                refCustomer: data[0].rif_cliente,
                productName: data[0]['nome prodotto'],
                denomination: data[0].denominaz,
                taxCode: data[0].codfisc
            } as InputDataCustomer
        }
        return inputData
    }
    catch (error) {
        console.error(error);
    }
}

/**
 * Questa funzione legge l'excel con i dati in input dal server sftp
 */
export const getCustomBilanci = async (sftp: Client, idAttachments: string, codiceFiscale: string) => {


    try {
        //genero il path dinamico del file
        let partsOfPath = generateIdAttachments(idAttachments)
        //estraggo e converto in json il file
        const file = await sftp.get(`${process.env.BASE_PATH_REQUEST_BILANCI}/${partsOfPath.join("/")}/original/bilanci.xlsx`)
        if (!(file)) {
            return false
        }
        const workbook = XLSX.read(file, { type: 'buffer' });
        const workSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[workSheetName];
        const data: BalanceSheetExcel[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        let inputData: {}
        if (data.length) {
            let referenceYears: string[] = []
            let balanceDetails: BalanceDetail[] = []
            let esisteBilancio: boolean = false
            for (let dato of data) {
                if (dato["piva/cf"] && dato["piva/cf"]?.toString()?.trim() === codiceFiscale?.trim()) {
                    esisteBilancio = true;
                    if (dato['Data Chiusura Bilancio anno N']) {
                        referenceYears.push(convertDate(dato['Data Chiusura Bilancio anno N']))
                        balanceDetails.push(
                            {
                                productionValue: dato['VALORE DELLA PRODUZIONE anno N'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['VALORE DELLA PRODUZIONE anno N'].toString())).toString().replace(",00", "") : '0',
                                revenues: dato['RICAVI anno N'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['RICAVI anno N'].toString())).toString().replace(",00", "") : '0',
                                cashFlow: dato['CASH FLOW anno N'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['CASH FLOW anno N'].toString())).toString().replace(",00", "") : '0',
                                profitLoss: dato['UTILE(PERDITA) ESERCIZIO anno N'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['UTILE(PERDITA) ESERCIZIO anno N'].toString())).toString().replace(",00", "") : '0',
                                active: dato['TOTALE ATTIVO anno N'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['TOTALE ATTIVO anno N'].toString())).toString().replace(",00", "") : '0',
                                fixedAssets: dato['IMMOBILIZZAZIONI anno N'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['IMMOBILIZZAZIONI anno N'].toString())).toString().replace(",00", "") : '0',
                                netAssets: dato['PATRIMONIO NETTO anno N'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['PATRIMONIO NETTO anno N'].toString())).toString().replace(",00", "") : '0',
                                numberOfEmployees: dato['NUMERO DIPENDENTI anno N'] ? dato['NUMERO DIPENDENTI anno N'].toString() : '0',
                                sales: dato['RICAVI anno N'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['RICAVI anno N'].toString())).toString().replace(",00", "") : '0',
                                tfr: dato['TFR anno N'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['TFR anno N'].toString())).toString().replace(",00", "") : '0',
                                creditToMembers: dato['A. CREDITI VERSO SOCI anno N'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['A. CREDITI VERSO SOCI anno N'].toString())).toString().replace(",00", "") : '0'
                            })
                    }
                    if (dato['Data Chiusura Bilancio anno N-1']) {
                        referenceYears.push(convertDate(dato['Data Chiusura Bilancio anno N-1']))
                        balanceDetails.push(
                            {
                                productionValue: dato['VALORE DELLA PRODUZIONE anno N-1'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['VALORE DELLA PRODUZIONE anno N-1'].toString())).toString().replace(",00", "") : '0',
                                revenues: dato['RICAVI anno N-1'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['RICAVI anno N-1'].toString())).toString().replace(",00", "") : '0',
                                cashFlow: dato['CASH FLOW anno N-1'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['CASH FLOW anno N-1'].toString())).toString().replace(",00", "") : '0',
                                profitLoss: dato['UTILE(PERDITA) ESERCIZIO anno N-1'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['UTILE(PERDITA) ESERCIZIO anno N-1'].toString())).toString().replace(",00", "") : '0',
                                active: dato['TOTALE ATTIVO anno N-1'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['TOTALE ATTIVO anno N-1'].toString())).toString().replace(",00", "") : '0',
                                fixedAssets: dato['IMMOBILIZZAZIONI anno N-1'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['IMMOBILIZZAZIONI anno N-1'].toString())).toString().replace(",00", "") : '0',
                                netAssets: dato['PATRIMONIO NETTO anno N-1'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['PATRIMONIO NETTO anno N-1'].toString())).toString().replace(",00", "") : '0',
                                numberOfEmployees: dato['NUMERO DIPENDENTI anno N-1'] ? dato['NUMERO DIPENDENTI anno N-1'].toString() : '0',
                                sales: dato['RICAVI anno N-1'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['RICAVI anno N-1'].toString())).toString().replace(",00", "") : '0',
                                tfr: dato['TFR anno N-1'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['TFR anno N-1'].toString())).toString().replace(",00", "") : '0',
                                creditToMembers: dato['A. CREDITI VERSO SOCI anno N-1'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['A. CREDITI VERSO SOCI anno N-1'].toString())).toString().replace(",00", "") : '0'
                            })
                    }
                    if (dato['Data Chiusura Bilancio anno N -2']) {
                        referenceYears.push(convertDate(dato['Data Chiusura Bilancio anno N -2']))
                        balanceDetails.push(
                            {
                                productionValue: dato['VALORE DELLA PRODUZIONE anno N-2'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['VALORE DELLA PRODUZIONE anno N-2'].toString())).toString().replace(",00", "") : '0',
                                revenues: dato['RICAVI anno N-2'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['RICAVI anno N-2'].toString())).toString().replace(",00", "") : '0',
                                cashFlow: dato['CASH FLOW anno N-2'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['CASH FLOW anno N-2'].toString())).toString().replace(",00", "") : '0',
                                profitLoss: dato['UTILE(PERDITA) ESERCIZIO anno N-2'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['UTILE(PERDITA) ESERCIZIO anno N-2'].toString())).toString().replace(",00", "") : '0',
                                active: dato['TOTALE ATTIVO anno N-2'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['TOTALE ATTIVO anno N-2'].toString())).toString().replace(",00", "") : '0',
                                fixedAssets: dato['IMMOBILIZZAZIONI anno N-2'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['IMMOBILIZZAZIONI anno N-2'].toString())).toString().replace(",00", "") : '0',
                                netAssets: dato['PATRIMONIO NETTO anno N-2'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['PATRIMONIO NETTO anno N-2'].toString())).toString().replace(",00", "") : '0',
                                numberOfEmployees: dato['NUMERO DIPENDENTI anno N-2'] ? dato['NUMERO DIPENDENTI anno N-2'].toString() : '0',
                                sales: dato['RICAVI anno N-2'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['RICAVI anno N-2'].toString())).toString().replace(",00", "") : '0',
                                tfr: dato['TFR anno N-2'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['TFR anno N-2'].toString())).toString().replace(",00", "") : '0',
                                creditToMembers: dato['A. CREDITI VERSO SOCI anno N-2'] ? Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(dato['A. CREDITI VERSO SOCI anno N-2'].toString())).toString().replace(",00", "") : '0'
                            }
                        )
                    }
                    break;
                }

            }

            if (!esisteBilancio) {
                return false;
            }

            console.log("data excel", data)
            inputData = {
                referenceYears: referenceYears,
                balanceDetails: balanceDetails,
                balanceDetailsPercentage: generateBalancePercentage(balanceDetails)
            }
        } else {
            return false
        }


        return inputData ? inputData : false
    }
    catch (error) {
        console.error(error);
    }
}

export const convertDate = (dateIntoNumber: number) => {
    return moment(new Date(new Date(1899, 11, 30).getTime() + (dateIntoNumber * 86400000))).format('YYYY')

}


/**
 * Questa funzione ti disconnette dal server sftp
 */
export const sftpDisconnection = async (sftp: Client) => {
    try {
       // await sftp.end();
    }
    catch (error) {
        throw new CustomError(500, 'Something went wrong with sftp disconnection')
    }
}

/**
 * Questa funzione chiude tutte le connessioni
 */
export const closeAllConnection = async (pgConnection: Sequelize, sftp: Client, mongoConnection?: typeof mongoose) => {
    if (mongoConnection) await mongodbDisconnection(mongoConnection);
    await postgresDisconnection(pgConnection);
    await sftpDisconnection(sftp);
}


export const returnArrayOfShareholdersList = (shareholdersList: any) => {
    const shareHolders = []
    if (Array.isArray(shareholdersList?.Shareholder)) {
        shareholdersList?.Shareholder?.forEach((holder: any) => {
            shareHolders.push({ name: holder?.ShareholderItem?.IndividualInformation?.Name?._text || '', percentage: holder?.PercentageShares?._text || '0' })
        })
    } else {
        const shared = { name: shareholdersList?.Shareholder?.ShareholderItem?.Aziendaslim?.MainShareholders?.ShareHolderName?._text || '', percentage: shareholdersList?.Shareholder?.PercentageShares?._text ? shareholdersList?.Shareholder?.PercentageShares?._text + '%' : '0' }
        if ((shared.name) && shared.name !== '') {
            shareHolders.push(shared)
        } else {
            shareHolders.push({ name: shareholdersList?.Shareholder?.ShareholderItem?.IndividualInformation?.Name?._text || '', percentage: shareholdersList?.Shareholder?.PercentageShares?._text ? shareholdersList?.Shareholder?.PercentageShares?._text + '%' : '0' })
        }
    }
    //generazione colore pie-chart
    let previousPercentage: number = 0;
    const holders = shareHolders?.map((holder, index) => {
        const currentColor = index == 0 ? '#023671' : randomColorBetween('#ADD8E6', '#1f497d');
        const symbolPercentage = holder.percentage.includes("%") ? holder.percentage.substring(0, holder.percentage.length - 1) : holder.percentage
        const member = {
            name: holder.name,
            color: currentColor,
            percentage: index == 0 ? `${currentColor} 0 ${symbolPercentage}%` : `${currentColor} ${previousPercentage}% ${previousPercentage + +symbolPercentage}%`,
            perc: `${symbolPercentage}%` || 0
        }
        previousPercentage += +holder.percentage;
        return member
    })
    return holders
}

function randomColorBetween(color1: string, color2: string) {
    const rgb1 = [
        parseInt(color1.substring(1, 3), 16),
        parseInt(color1.substring(3, 5), 16),
        parseInt(color1.substring(5, 7), 16),
    ];
    const rgb2 = [
        parseInt(color2.substring(1, 3), 16),
        parseInt(color2.substring(3, 5), 16),
        parseInt(color2.substring(5, 7), 16),
    ];
    const r = Math.floor(
        Math.random() * (Math.max(rgb1[0], rgb2[0]) - Math.min(rgb1[0], rgb2[0]) + 1) +
        Math.min(rgb1[0], rgb2[0])
    );
    const g = Math.floor(
        Math.random() * (Math.max(rgb1[1], rgb2[1]) - Math.min(rgb1[1], rgb2[1]) + 1) +
        Math.min(rgb1[1], rgb2[1])
    );
    const b = Math.floor(
        Math.random() * (Math.max(rgb1[2], rgb2[2]) - Math.min(rgb1[2], rgb2[2]) + 1) +
        Math.min(rgb1[2], rgb2[2])
    );
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
        .toString(16)
        .padStart(2, '0')}`;
}

//Generazione Sezione Bilancio
export const generateBalance = (BalanceSheetInfo: any, CompanyEmployee: any) => {
    const referenceYears: string[] = []
    const balanceDetails: BalanceDetail[] = []
    console.log('[BalanceSheetInfo]', BalanceSheetInfo)
    if (Array.isArray(BalanceSheetInfo)) {
        BalanceSheetInfo?.forEach((sheet: any) => {
            referenceYears.push(sheet.ReferenceYear?._text)
            balanceDetails.push({
                productionValue: moltiplyForOneThousand(sheet.ProfitAndLoss?.TotalRevenues?.Value?._text),
                revenues: moltiplyForOneThousand(sheet.ProfitAndLoss?.Sales?.Value?._text),
                cashFlow: moltiplyForOneThousand(sheet.ProfitAndLoss?.CashFlow?.Value?._text),
                profitLoss: moltiplyForOneThousand(sheet.ProfitAndLoss?.ProfitAndLoss?.Value?._text),
                active: moltiplyForOneThousand(sheet.Assets?.TotalAssets?.Value._text),
                fixedAssets: moltiplyForOneThousand(sheet.Assets?.FixedAssets?.Value?._text),
                netAssets: moltiplyForOneThousand(sheet.LiabilitiesAndShareholderEquity?.ShareholdersFunds?.Value?._text),
                numberOfEmployees: CompanyEmployee?.NumberOfEmployees?._text,
                sales: moltiplyForOneThousand(sheet.ProfitAndLoss?.Sales?.Value?._text),
                tfr: moltiplyForOneThousand(sheet.LiabilitiesAndShareholderEquity?.ConsolidatedFundsAndDebts?.Value?._text),
                creditToMembers: moltiplyForOneThousand(sheet.LiabilitiesAndShareholderEquity?.TradeCreditors?.Value?._text),
            })
        })
    } else if (BalanceSheetInfo) {
        referenceYears.push(BalanceSheetInfo?.ReferenceYear?._text)
        balanceDetails.push({
            productionValue: moltiplyForOneThousand(BalanceSheetInfo?.ProfitAndLoss?.TotalRevenues?.Value?._text),
            revenues: moltiplyForOneThousand(BalanceSheetInfo?.ProfitAndLoss?.Sales?.Value?._text),
            cashFlow: moltiplyForOneThousand(BalanceSheetInfo?.ProfitAndLoss?.CashFlow?.Value?._text),
            profitLoss: moltiplyForOneThousand(BalanceSheetInfo?.ProfitAndLoss?.ProfitAndLoss?.Value?._text),
            active: moltiplyForOneThousand(BalanceSheetInfo?.Assets?.TotalAssets?.Value._text),
            fixedAssets: moltiplyForOneThousand(BalanceSheetInfo?.Assets?.FixedAssets?.Value?._text),
            netAssets: moltiplyForOneThousand(BalanceSheetInfo?.LiabilitiesAndShareholderEquity?.ShareholdersFunds?.Value?._text),
            numberOfEmployees: CompanyEmployee?.NumberOfEmployees?._text,
            sales: moltiplyForOneThousand(BalanceSheetInfo?.ProfitAndLoss?.Sales?.Value?._text),
            tfr: moltiplyForOneThousand(BalanceSheetInfo?.LiabilitiesAndShareholderEquity?.ConsolidatedFundsAndDebts?.Value?._text),
            creditToMembers: moltiplyForOneThousand(BalanceSheetInfo?.LiabilitiesAndShareholderEquity?.TradeCreditors?.Value?._text),
        })
    }
    console.log('[balanceDetails]', balanceDetails)
    const balanceDetailsPercentage: BalanceDetailWithColor[] = generateBalancePercentage(balanceDetails)
    return {
        referenceYears: referenceYears,
        balanceDetails: balanceDetails,
        balanceDetailsPercentage: balanceDetailsPercentage
    }
}

function moltiplyForOneThousand(numberOfBalance: any) {
    if (numberOfBalance) {
        return Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseInt(numberOfBalance) * 1000).toString().replace(",00", "")
    } else
        return numberOfBalance
}

function generateBalancePercentage(balanceDetails: BalanceDetail[]) {
    const balanceDetailsPercentage = []
    for (let i = 0; i < 2; i++) {
        balanceDetailsPercentage.push({
            productionValue: calcateValuePercentage(balanceDetails[i + 1]?.productionValue || '', balanceDetails[i]?.productionValue || ''),
            revenues: calcateValuePercentage(balanceDetails[i + 1]?.revenues || '', balanceDetails[i]?.revenues || ''),
            cashFlow: calcateValuePercentage(balanceDetails[i + 1]?.cashFlow || '', balanceDetails[i]?.cashFlow || ''),
            profitLoss: calcateValuePercentage(balanceDetails[i + 1]?.profitLoss || '', balanceDetails[i]?.profitLoss || ''),
            active: calcateValuePercentage(balanceDetails[i + 1]?.active || '', balanceDetails[i]?.active || ''),
            fixedAssets: calcateValuePercentage(balanceDetails[i + 1]?.fixedAssets || '', balanceDetails[i]?.fixedAssets || ''),
            netAssets: calcateValuePercentage(balanceDetails[i + 1]?.netAssets || '', balanceDetails[i]?.netAssets || ''),
            sales: calcateValuePercentage(balanceDetails[i + 1]?.sales || '', balanceDetails[i]?.sales || ''),
            tfr: calcateValuePercentage(balanceDetails[i + 1]?.tfr || '', balanceDetails[i]?.tfr || ''),
            creditToMembers: calcateValuePercentage(balanceDetails[i + 1]?.creditToMembers || '', balanceDetails[i]?.creditToMembers || ''),
        })
    }
    return balanceDetailsPercentage
}

function calcateValuePercentage(value1: string, value2: string) {
    value1 = value1.substring(0, value1.length - 2).replace(".", "")
    value2 = value2.substring(0, value2.length - 2).replace(".", "")
    console.log("value1", value1)
    console.log("value2", value2)
    let percentage = '';
    if (value1 === "0" && value2 === "0") {
        percentage = '0'
    }
    else if (+value1 == 0 && +value2 == 0) {
        percentage = 'N/C';
    } else if (+value1 == 0) {
        percentage = '';
    } else {
        percentage = calcatePercentage(+value1, +value2)?.toString() || '0'
    }
    return {
        value: percentage,
        color: getColorPercentage(percentage)
    }
}

function calcatePercentage(x: number, y: number, fixed = 2) {
    const percent = ((y - x) / Math.abs(x)) * 100;

    if (!isNaN(percent)) {
        return Number(percent.toFixed(fixed));
    } else {
        return null;
    }
}

function getColorPercentage(percentage: string) {
    return +percentage > 0 ? '#1f497d' : '#ff0000'
}
//

//Gestione Codici Report e Query Complementari
export const generateReportFromCode = async (request: any, pgConnection: Sequelize, sftp: any, isControlCerved: boolean) => {
    const { customer_id, id_request, campaign_kind_id, investigation_record_id, codice_fiscale, created_at, investigated_subject_id, id_entrust, date_create_entrust, author_id, entrust_code, codicifiscaliandcustomcode, ck_name } = request;
    const dateOfRequest = moment(date_create_entrust).format('DD/MM/YYYY');
    let customerInput;
    // RECUPERO DA SFTP DATI INPUT
    customerInput = await getCustomerInput(sftp, id_request)

    if (!(customerInput))
        customerInput = {}

let campaign_kind_id_modify = campaign_kind_id
    console.log("campaign_kind_id iniziale ", campaign_kind_id);
    if (campaign_kind_id_modify === '779' || campaign_kind_id_modify === '396' || campaign_kind_id_modify === '790' || campaign_kind_id_modify === '791') {
        campaign_kind_id_modify = '705'
    } else if (campaign_kind_id_modify === '783' || campaign_kind_id_modify === '784') {
        campaign_kind_id_modify = '713'
    } else if (campaign_kind_id_modify === '782' || campaign_kind_id_modify === '785') { 
        campaign_kind_id_modify = '714'
    } else if (campaign_kind_id_modify === '780') {
        campaign_kind_id_modify = '684'
    } else if (campaign_kind_id_modify === '781' || campaign_kind_id_modify === '786') {
        campaign_kind_id_modify = '712'
    } else if (campaign_kind_id_modify === '787') {
        campaign_kind_id_modify = '684'
    } else if (campaign_kind_id_modify === '799') {
        campaign_kind_id_modify = '709'
    } else if (campaign_kind_id_modify === '800') {
        campaign_kind_id_modify = '711'
    } else if (campaign_kind_id_modify === '215' || campaign_kind_id_modify === '789') {
        campaign_kind_id_modify = '702'
    }

    if (campaign_kind_id_modify == '792') {
        if (codice_fiscale?.length === 11) {
            campaign_kind_id_modify = '792G';
        } else {
            campaign_kind_id_modify = '792F';
        }
    }
    
    switch (campaign_kind_id_modify) {
        case '698': //indagine search approfonditi - persona giuridica
        case '684': //indagine search - persona giuridica
        case '714': //indagine search ligth - persona giuridica
        case '694': //TLC SRL - PG e NoCorporate
        case '704': //Platinum Persona Giuridica
        case '875': //Coface Persona Giuridica
        case '711': //Money Light PG
        case '708': //Money Plus PG
        case '716': //GoNoG Persona Giuridica   
        case '699': //decodifica partita iva
        case '769': //indagine search medium - persona giuridica
        case '801':
        case '819':
        case '792G':
            await personaGiuridicaService(id_request, codice_fiscale, dateOfRequest, sftp, pgConnection, investigation_record_id, investigated_subject_id, customer_id, campaign_kind_id_modify, id_entrust, author_id, entrust_code, codicifiscaliandcustomcode, customerInput, isControlCerved, ck_name);
            break
        case '696': //indagine search approfonditi - persona fisica
        case '683': //indagine search - persona fisica
        case '713': //indagine search ligth - persona fisica
        case '703': //platinum - persona fisica
        case '707': //money plus - persona fisica
        case '709': //money Light - persona fisica
        case '693': // tlc - pf
        case '715': // go/no go - pf
        case '712': //indagine search - persona fisica
        case '811': //rintraccio anagrafico - persona fisica
        case '705': //rintraccio professione
        case '768': //indagine search medium - persona fisica
        case '779': //rintraccio professione 
        case '706': //rintraccio professione light
        case '818': 
        case '792F':
            await personaFisicaService(id_request, codice_fiscale, dateOfRequest, sftp, pgConnection, investigation_record_id, investigated_subject_id, customer_id, campaign_kind_id_modify, id_entrust, author_id, entrust_code, codicifiscaliandcustomcode, isControlCerved, customerInput, ck_name);
            break
        case '702': //eredi plus        // CODICE DA CAMBIARE
        case '701': //eredi medium      // CODICE DA CAMBIARE
        case '700': //eredi basic       // CODICE DA CAMBIARE
            await erediService(id_request, codice_fiscale, dateOfRequest, sftp, pgConnection, investigation_record_id, investigated_subject_id, customer_id, campaign_kind_id_modify, id_entrust, author_id, entrust_code, codicifiscaliandcustomcode, isControlCerved, customerInput, ck_name)
            break
    }

}


//Converter Response Query Conti Correnti
export function convertContiCorrenti(results: any[]) {
    const contiCorrenti: ContoCorrente[] = []
    if (results.length) {
        results?.forEach(contoCorrente => {
            contiCorrenti.push({
                address: `${contoCorrente.indirizzo_toponimo || ''} ${contoCorrente.indirizzo_via || ''} ${contoCorrente.indirizzo_civico || ''} - ${contoCorrente.indirizzo_cap || ''} ${contoCorrente.indirizzo_comune || ''} ${contoCorrente.indirizzo_provincia ? `(${contoCorrente.indirizzo_provincia})` : ''}`,
                businessName: contoCorrente.ragione_sociale_banca || '',
                city: contoCorrente.indirizzo_comune || '',
                piva: contoCorrente.partita_iva_banca || '',
                abi: contoCorrente.abi || '',
                cab: contoCorrente.cab || '',
                toponimo: contoCorrente.indirizzo_toponimo || '',
                streetName: contoCorrente.indirizzo_via || '',
                streetNumber: contoCorrente.indirizzo_civico || '',
                cap: contoCorrente.indirizzo_cap || '',
                province: contoCorrente.indirizzo_provincia || '',
                note: contoCorrente.note || ''
            })
        })
    }
    return contiCorrenti
}
//

//Converter Response Query eredi
export async function convertErediAccettanti(results: any[]) {
    const erediAccettanti: Eredi[] = []
    if (results.length) {
        for (let i = 0; i < results.length; i++) {
            if (results[i].codice_fiscale?.length) {
                const codiceFiscale = new CodiceFiscale(results[i].codice_fiscale);
                const data = await findRealEstateData(results[i].codice_fiscale, false);
                const noteWithoutFirstWord = results[i].note?.split(":")[1];
                const telephones = noteWithoutFirstWord?.split(";");
                erediAccettanti.push({
                    surname: results[i].cognome,
                    firstName: results[i].nome,
                    dateOfBirth: moment(codiceFiscale.birthday).format('DD-MM-YYYY'),
                    birthPlace: codiceFiscale.birthplace.nome,
                    countryOfBirth: codiceFiscale.birthplace.prov,
                    taxIdCode: results[i].codice_fiscale,
                    address: `${results[i].indirizzo_toponimo || ''} ${results[i].indirizzo_via || ''} ${results[i].indirizzo_civico || ''} - ${results[i].indirizzo_cap || ''} ${results[i].indirizzo_comune || ''} ${results[i].indirizzo_provincia ? `(${results[i].indirizzo_provincia})` : ''}`,
                    postalCode: results[i].indirizzo_cap,
                    city: results[i].indirizzo_comune,
                    province: results[i].indirizzo_provincia,
                    telephones,
                    buildings: data?.fabbricati?.length || data?.terreni?.length ? true : false,
                    accettaEredita: results[i].accettazione_eredita,
                    parentela: results[i].grado_parentela || ''
                })
            }
        }
    }
    return erediAccettanti
}



//Converter Response Query eredi chiamati
export async function convertErediChiamati(results: any[]) {
    const erediChiamati: Eredi[] = []
    if (results.length) {
        for (let i = 0; i < results.length; i++) {
            if (results[i].codice_fiscale?.length) {
                const codiceFiscale = new CodiceFiscale(results[i].codice_fiscale)
                const data = await findRealEstateData(results[i].codice_fiscale, false)
                const parentela = results[i].note?.split(":")[0];
                const noteWithoutFirstWord = results[i].note?.split(":")[1]
                const telephones = noteWithoutFirstWord?.split(";")
                erediChiamati.push({
                    surname: results[i].cognome,
                    firstName: results[i].nome,
                    dateOfBirth: moment(codiceFiscale.birthday).format('DD/MM/YYYY'),
                    birthPlace: codiceFiscale.birthplace.nome,
                    countryOfBirth: codiceFiscale.birthplace.prov,
                    taxIdCode: results[i].codice_fiscale,
                    address: `${results[i].indirizzo_toponimo || ''} ${results[i].indirizzo_via || ''} ${results[i].indirizzo_civico || ''} - ${results[i].indirizzo_cap || ''} ${results[i].indirizzo_comune || ''} ${results[i].indirizzo_provincia ? `(${results[i].indirizzo_provincia})` : ''}`,
                    postalCode: results[i].indirizzo_cap,
                    city: results[i].indirizzo_comune,
                    province: results[i].indirizzo_provincia,
                    telephones,
                    buildings: data?.fabbricati?.length || data?.terreni?.length ? true : false,
                    accettaEredita: results[i].accettazione_eredita,
                    parentela: parentela || ''  
                })
            }
        }
    }
    return erediChiamati
}

//Converter Response Query Recapiti Telefonici
export function convertRecapitiTelefonici(results: any[]) {
    const recapitiTelefonici: RecapitiTelefonici[] = []
    if (results?.length) {
        results?.forEach(recapitoTelefonico => {
            recapitiTelefonici.push({
                contact: recapitoTelefonico.numero || '',
                fixed: recapitoTelefonico.numero ? (Array.from(recapitoTelefonico.numero)[0] === '0' ? true : false) : false,
                note: recapitoTelefonico.note || ''
            })
        })
    }
    return recapitiTelefonici
}
//

//Converter Response Query Proprita - Immobili con stima
export async function convertBuilding(codiceFiscale: string, estimate: boolean) {
    let lands: any[] = []
    let buildings: any[] = []
    let ojbectToWork = { fabbricati: [], terreni: [] } as any

    //CHIAMATA CERVED PER IL RECUPERO BASE DI TERRENI E FABBRICATI
    const data = await findRealEstateData(codiceFiscale, false)

    //SE CI SONO RISULTATI ED E' RICHIESTA LA STIMA IMMOBILIARE EFFETTUO LA CHIAMATA PER LE SPECIFICHE
    if (data?.fabbricati?.length && estimate) {
        //CHIAMATA CERVED PER IL RECUPERO DELLE VALUTAZIONI DI TERRENI E FABBRICATI
        const data = await findRealEstateData(codiceFiscale, true)
        //PRENDO I DATI CON VALUTAZIONE
        ojbectToWork.fabbricati = data.fabbricati
        ojbectToWork.terreni = data.terreni
    } else {
        //PRENDO I DATI SENZA VALUTAZIONE
        ojbectToWork.fabbricati = data.fabbricati;
        ojbectToWork.terreni = data.terreni;
    }

    //CHIMATA PER RECUPERARE I COINTESTATARI PER TERRENO
    var maxNumberOfLands = 100;
    var numberOfLands = 0;
    if (ojbectToWork?.terreni) {
        for (let land of ojbectToWork?.terreni) {
            try {
                numberOfLands++;
                //if (numberOfLands > maxNumberOfLands) {
                    const dataRequest = { "codiceBelfiore": land.codiceBelfiore, "foglio": land.foglio, "particella": land.particella }
                    const data = await findJointOwner(dataRequest, 'land', codiceFiscale)
                    const { possessi } = data?.terreni && data?.terreni[0] ? data?.terreni[0] : data?.fabbricati[0]
                    if (possessi.length)
                        lands.push({
                            ...land,
                            possessi
                        })
                ///} else {
                //    break;
                //}
            } catch (error: any) {
                if (error.response?.status !== 404) console.log(500, 'Something went wrong with baseJointOwnerLand')
                console.error(error)
                lands.push({
                    ...land
                })
            }
        }
    }

    //CHIMATA PER RECUPERARE I COINTESTATARI PER IMMOBILE
    var maxNumberOfBuilds = 100;
    var numberOfBuilds = 0;  
    if (ojbectToWork?.fabbricati) {
        for (let build of ojbectToWork?.fabbricati) {
            try {
                numberOfBuilds++;
                // if (numberOfBuilds > maxNumberOfBuilds) {                
                    if (build.stimaFabbricato) {
                        build.stimaFabbricato.valoreMinNormale = convertCurrency(build?.stimaFabbricato?.valoreMinNormale, 'EURO') || '';
                        build.stimaFabbricato.valoreMaxNormale = convertCurrency(build?.stimaFabbricato?.valoreMaxNormale, 'EURO') || '';
                        build.stimaFabbricato.valorePuntuale = convertCurrency(build?.stimaFabbricato?.valorePuntuale, 'EURO') || '';
                        build.stimaFabbricato.valoreLocazione = convertCurrencyPerc(build?.rendita, 'EURO') || '';
                    }
                    const dataRequest = { "codiceBelfiore": build.codiceBelfiore, "foglio": build.foglio, "particella": build.particella, "subalterno": build.subalterno };
                    const data = await findJointOwner(dataRequest, 'build', codiceFiscale)
                    
//                    const { possessi } = data?.terreni && data?.terreni[0] ? data?.terreni[0] : data?.fabbricati[0]
                    const { possessi } = data?.fabbricati[0]
                    buildings.push({
                        ...build,
                        possessi,
                        estimate
                    })
                //} else {
                //    break;
                // }                   
            } catch (error: any) {
                if (error.response?.status !== 404) console.log(500, 'Something went wrong with baseJointOwnerBuilding')
                console.error(error)
                buildings.push({
                    ...build,
                    estimate
                })
            }
        }
    }

    //ACCOMUNO I TERRENI PER COMUNE
    const landsToOrder = lands?.reduce((acc: any, curr: any) => {
        const key = curr.descrizioneComune;
        if (acc[key]) {
            acc[key].push(curr);
        } else {
            acc[key] = [curr];
        }
        return acc;
    }, {});
    const landsOrdedByMunicipal: any = Object.keys(landsToOrder).map(city => {
        return {
            city: city,
            rows: landsToOrder[city]
        }
    })

    //ACCOMUNO I FABBRICATI PER COMUNE
    const buildingsToOrder = buildings?.reduce((acc: any, curr: any) => {
        const key = curr.descrizioneComune;
        if (acc[key]) {
            acc[key].push(curr);
        } else {
            acc[key] = [curr];
        }
        return acc;
    }, {});
    const buildingsOrdedByMunicipal: any = Object.keys(buildingsToOrder).map(city => {
        return {
            city: city,
            rows: buildingsToOrder[city]
        }
    })

    return {
        find: landsOrdedByMunicipal.length || buildingsOrdedByMunicipal.length ? true : false,
        data: {
            lands: landsOrdedByMunicipal,
            buildings: buildingsOrdedByMunicipal
        }
    }
}
//

//Converter Response Query Proprieta - Immobili senza stima
export async function convertBuildingWithoutEstimation(investigation_record_id: string, pgConnection: Sequelize) {
    const [resultProprieta, metadata] = await pgConnection.query(generateQueryProprieta(investigation_record_id));
    const rows: any = []
    if (resultProprieta.length) {
        for (let property of resultProprieta as any) {
            if (property?.catasto?.length) {
                rows.push({
                    city: property.indirizzo_comune || '',
                    landRegister: property.catasto || '',
                    address: `${property.indirizzo_toponimo || ''} ${property.indirizzo_via || ''} ${property.indirizzo_civico || ''}`,
                    foglio: property.foglio || '',
                    particella: property.particella || '',
                    sub: property.sub || '',
                    titolarita: property.titolarita || '',
                    classamento: property.classamento || '',
                    class: property.classe || '',
                    conservatory: property.consistenza || '',
                    annuity: property.rendita || '',
                    partita: property.partita || '',
                    repertorio: property.repertorio || ''
                })
            }
        }
    }

    const partialResult = rows.reduce((acc: any, curr: any) => {
        const key = curr.city;
        if (acc[key]) {
            acc[key].push(curr);
        } else {
            acc[key] = [curr];
        }
        return acc;
    }, {});

    const result = Object.keys(partialResult).map(city => {
        return {
            city: city,
            rows: partialResult[city]
        }
    })
    return {
        find: result.length ? true : false,
        estimate: false,
        data: result
    }
}
//

export function generateBankingRelationships(contiCorrenti: ContoCorrente[]) {
    const bankingRelationships: BankingRelationship[] = []
    contiCorrenti?.forEach(contoCorrente => {

        var strToponimo = contoCorrente.toponimo ? contoCorrente.toponimo : '';
        const isEmpty = !contoCorrente.businessName && !contoCorrente.city && !contoCorrente.piva && !contoCorrente.abi && !contoCorrente.cab &&
            !strToponimo && !contoCorrente.streetName && !contoCorrente.streetNumber && !contoCorrente.cap && !contoCorrente.province;

        if (!isEmpty) {
            bankingRelationships.push({
                ...contoCorrente,
                address: contoCorrente.streetName ? `${strToponimo} ${contoCorrente.streetName} ${contoCorrente.streetNumber} - ${contoCorrente.cap} ${contoCorrente.city} (${contoCorrente.province})` : '',
            })
        }

    })
    return bankingRelationships
}

export function companyShareholdingsPersonaFisica(holdings: any) {
    const companySheets: CompanyShareholding[] = [];
    if (holdings && Array.isArray(holdings)) {
        holdings?.forEach((holding: any) => {
            const isShareArray = holding?.Shares?.List?.Share && Array.isArray(holding?.Shares?.List?.Share)
            companySheets.push({
                company: holding?.Company?.Name?._text || '',
                taxCode: holding?.Company?.TaxCode?._text || '',
                legalForm: holding?.Company?.Form?._text || '',
                capitalValue: `${holding?.Shares?.EquityCapital?._text}€` || '',
                depositDate: moment(new Date(holding?.Deed?.FilingDate?._attributes?.year, (holding?.Deed?.FilingDate?._attributes?.month - 1), holding?.Deed?.FilingDate?._attributes?.day)).format("DD/MM/YYYY") || '',
                site: `${holding?.Company?.RegisteredHeadOffice?.Address?._text || ''} ${holding?.Company?.RegisteredHeadOffice?.PostCode?._text || ''} ${holding?.Company?.RegisteredHeadOffice?.Municipality?._text || ''} ${holding?.Company?.RegisteredHeadOffice?.ProvinceCode?._text || ''}`,
                activityStatus: holding?.Company?.ActivityStatus?.Description?._text || '',
                typeOfactivity: holding?.Company?.Ateco2007?._text || '',
                protocolNumber: holding?.Deed?.ReferenceNo?._text || '',
                nominalValue: ((isShareArray ? `${holding?.Shares?.List?.Share[0]?.ShareValue?._text}` : `${holding?.Shares?.List?.Share?.ShareValue?._text}`) || '') + '€',
                possessionPercentage: ((isShareArray ? `${holding?.Shares?.List?.Share[0]?.ShareValue?._attributes?.Percentage}` : `${holding?.Shares?.List?.Share?.ShareValue?._attributes?.Percentage}`) || '') + '%',
                straightDescription: (isShareArray ? holding?.Shares?.List?.Share[0]?.RightsType?._text : holding?.Shares?.List?.Share?.RightsType?._text) || '',
            })
        })
    } else if (holdings) {
        if (holdings?.Company?.Name?._text) {
            const isShareArray = holdings?.Shares?.List?.Share && Array.isArray(holdings?.Shares?.List?.Share)
            companySheets.push({
                company: holdings?.Company?.Name?._text || '',
                taxCode: holdings?.Company?.TaxCode?._text || '',
                legalForm: holdings?.Company?.Form?._text || '',
                capitalValue: `${holdings?.Shares?.EquityCapital?._text}€` || '',
                depositDate: moment(new Date(holdings?.Deed?.FilingDate?._attributes?.year, (holdings?.Deed?.FilingDate?._attributes?.month - 1), holdings?.Deed?.FilingDate?._attributes?.day)).format("DD/MM/YYYY") || '',
                site: `${holdings?.Company?.RegisteredHeadOffice?.Address?._text || ''} ${holdings?.Company?.RegisteredHeadOffice?.PostCode?._text || ''} ${holdings?.Company?.RegisteredHeadOffice?.Municipality?._text || ''} ${holdings?.Company?.RegisteredHeadOffice?.ProvinceCode?._text || ''}`,
                activityStatus: holdings?.Company?.ActivityStatus?.Description?._text || '',
                typeOfactivity: holdings?.Company?.Ateco2007?._text || '',
                protocolNumber: holdings?.Deed?.ReferenceNo?._text || '',
                nominalValue: ((isShareArray ? `${holdings?.Shares?.List?.Share[0]?.ShareValue?._text}` : `${holdings?.Shares?.List?.Share?.ShareValue?._text}`) || '') + '€',
                possessionPercentage: ((isShareArray ? `${holdings?.Shares?.List?.Share[0]?.ShareValue?._attributes?.Percentage}` : `${holdings?.Shares?.List?.Share?.ShareValue?._attributes?.Percentage}`) || '') + '%',
                straightDescription: (isShareArray ? holdings?.Shares?.List?.Share[0]?.RightsType?._text : holdings?.Shares?.List?.Share?.RightsType?._text) || '',
            })
        }
    }
    return companySheets
}
export function convertCurrencyPerc(value: string, currency: string) {
    if (currency === 'EURO') {
        const preValue = parseFloat(value.toString()) * 12
        return new Intl.NumberFormat('de-DE', socialCapitalOptions).format(Math.floor(preValue + ((preValue * (Math.floor(Math.random() * 6) + 1)) / 100)))
    } else return value
}

export function convertCurrency(value: string | number, currency: string) {
    if (currency === 'EURO') {
        if (typeof value === "string" && value.includes("€")) {
            return value
        } else if (typeof value === "string") {
            value = parseFloat(value.replace(".", "").replace(",", "."))
        }
        return new Intl.NumberFormat('de-DE', socialCapitalOptions).format(value as number).toString()
    } else return value
}

export function convertResidences(records: any[]) {
    const result: string[] = []
    records.forEach(row => {
        if (row.residenza__indirizzo_comune)
            result.push(`${row.residenza__indirizzo_toponimo} ${row.residenza__indirizzo_via} ${row.residenza__indirizzo_civico} - ${row.residenza__indirizzo_cap} ${row.residenza__indirizzo_comune} ${row.residenza__indirizzo_provincia ? `(${row.residenza__indirizzo_provincia})` : ''}`)
    })
    return result
}

export function convertDomicilio(records: any[]) {
    let results: {
        address: string,
        postalCode: string,
        common: string,
        province: string,
    }[] = [];

    records.forEach(row => {
        if (row.residenza__indirizzo_comune) {
            let result = {
                address: `${row?.residenza__indirizzo_toponimo} ${row?.residenza__indirizzo_via}` || "",
                postalCode: row?.residenza__indirizzo_cap || "",
                common: row?.residenza__indirizzo_comune || "",
                province: row?.residenza__indirizzo_provincia || ""
            }
            results?.push(result);
        }
    })
    return results;
}

//Converter Response Query Investigation_record for GIUDIZIO RECUPERABILITA'
export function convertGiudizioRecuperabilita(results: any[]) {
    const recoverabilityJudgment = results.length ? results[0]?.esito_pratica__recuperabilita?.toLowerCase() || '' : ''
    return recoverabilityJudgment
}
//

//Converter Response Query Investigation_record for OPERATIVITA'
export function converterOperativita(results: any[]) {
    const note = results[0]?.societa__note || ''
    const operativity = note?.split("|")[0] || ''
    return operativity.trim().toUpperCase()
}
//

//Converter Response Query Investigation_record for APPROFONDIMENTI IPOTECARI'
export function converterApprofondimentiIpotecari(results: any[]) {
    const note = results[0]?.societa__note || ''
    const insights = note?.split("|")[3] || ''
    const trimmedInsights = insights.trim().toUpperCase()

    return trimmedInsights.length > 0 ? "presente" : ""
}

//Converter Response Query Investigation_record for INDAGINI NEGOZIALI
export function converterIndaginiNegozialiOld(results: any[]) {
    const investigationsSocieta: any[] = []
    const investigationsPersona: any[] = []

    const societa__note = results[0]?.societa__note || ''
    const societaInvestigations = societa__note?.split("|")[1] || ''
    const arrayOfSocietaInvestigations = ['NON SI RILEVANO CANONI DI LOCAZIONE', 'NON SI RILEVANO INDAGINI NEGOZIALI'].includes(societaInvestigations) ? [] : societaInvestigations?.split('\n');
    if (arrayOfSocietaInvestigations[0]?.length) {
        arrayOfSocietaInvestigations?.forEach((element: string) => {
            if (element.length) {
                const regex = new RegExp("\\b(" + wordsToReplaceInvestigation.join("|") + ")\\b", "gi");
                const investigationPartialReplaced = element.replace(regex, '');
                const partOfInvestigations = investigationPartialReplaced?.split(';');
                investigationsSocieta.push({
                    title: partOfInvestigations[4]?.trim() || '',
                    registration: partOfInvestigations[3]?.trim() || '',
                    declaredValue: partOfInvestigations[5]?.trim() || '',
                    name: partOfInvestigations[0]?.trim() || '',
                    copartiTaxCode: partOfInvestigations[1]?.trim() || '',
                    dateOfBirthday: '',
                    address: partOfInvestigations[2]?.trim() || '',
                    controparteTaxCode: partOfInvestigations[7]?.trim() || '',
                    municipalityOfBirth: ''
                })
            }
        });
    }

    const persona_fisica__note = results[0]?.persona_fisica__note || ''
    const personaFisicaInvestigations = persona_fisica__note?.split("|")[1] || ''
    const arrayOfPersonaFisicaInvestigations = ['NON SI RILEVANO CANONI DI LOCAZIONE', 'NON SI RILEVANO INDAGINI NEGOZIALI'].includes(personaFisicaInvestigations) ? [] : personaFisicaInvestigations?.split('\n');
    if (arrayOfPersonaFisicaInvestigations[0]?.length) {
        arrayOfPersonaFisicaInvestigations?.forEach((element: string) => {
            if (element.length) {
                const regex = new RegExp("\\b(" + wordsToReplaceInvestigation.join("|") + ")\\b", "gi");
                const investigationPartialReplaced = element.replace(regex, '');
                const partOfInvestigations = investigationPartialReplaced?.split(';');
                investigationsPersona.push({
                    title: partOfInvestigations[4]?.trim() || '',
                    registration: partOfInvestigations[3]?.trim() || '',
                    declaredValue: partOfInvestigations[5]?.trim() || '',
                    name: partOfInvestigations[0]?.trim() || '',
                    copartiTaxCode: partOfInvestigations[1]?.trim() || '',
                    dateOfBirthday: '',
                    address: partOfInvestigations[2]?.trim() || '',
                    controparteTaxCode: partOfInvestigations[7]?.trim() || '',
                    municipalityOfBirth: ''
                })
            }
        });
    }
    return {
        investigationsSocieta,
        investigationsPersona
    }
}

export function converterIndaginiNegoziali(resultsPersonaFisica: any[]) {
    const investigationsSocieta: any[] = []
    const investigationsPersona: any[] = []

    if (resultsPersonaFisica.length === 0) {
        return {
            investigationsSocieta,
            investigationsPersona
        }
    }

    const singleResult = resultsPersonaFisica[0]
    if (singleResult.tipologia_indagine?.length) {

        var jsonCoparti: any = {
            name: '',
            copartiTaxCode: '',
            address: '',
        };

        var jsonControparti: any = {
            controparteTaxCode: '',
        };

        if (singleResult.coparti) {
            jsonCoparti.name = (singleResult.coparti[0]?.nome + ' ' + singleResult.coparti[0]?.cognnome)?.trim() || '';
            jsonCoparti.copartiTaxCode = singleResult.coparti[0]?.codice_fiscale?.trim() || '';
            jsonCoparti.address = (singleResult.coparti[0]?.toponimo || '' + ' ' + singleResult.coparti[0]?.via + ', ' + singleResult.coparti[0]?.civico + ' ' + singleResult.coparti[0]?.comune + ' (' + singleResult.coparti[0]?.provincia + ')')?.trim() || '';

        }

        if (singleResult.controparti) {
            jsonControparti.controparteTaxCode = singleResult.controparti[0]?.codice_fiscale?.trim() || '';
            jsonControparti.controparteDenominazione = singleResult.controparti[0]?.denominazione?.trim() || '';
        }

        investigationsSocieta.push({
            title: singleResult.tipologia_indagine?.trim() || '',
            registration: singleResult.data_registrazione?.trim() || '',
            declaredValue: singleResult.valore_dichiarato,
            name: jsonCoparti.name,
            copartiTaxCode: jsonCoparti.copartiTaxCode,
            dateOfBirthday: '',
            address: jsonCoparti.address,
            controparteTaxCode: jsonControparti.controparteTaxCode,
            municipalityOfBirth: ''
        })

        investigationsPersona.push({
            title: singleResult.tipologia_indagine?.trim() || '',
            registration: singleResult.data_registrazione?.trim() || '',
            declaredValue: singleResult.valore_dichiarato,
            name: jsonCoparti.name,
            copartiTaxCode: jsonCoparti.copartiTaxCode,
            dateOfBirthday: '',
            address: jsonCoparti.address,
            controparteTaxCode: jsonControparti.controparteTaxCode,
            municipalityOfBirth: ''
        })
    }
    return {
        investigationsSocieta,
        investigationsPersona
    }
}

//Converter Response Query Investigation_record for INDAGINI NEGOZIALI
export function converterIndaginiNegozialiPersonaGiuridica(resultsSocieta: any[], resultsLegali: any[]) {
    const investigationsSocieta: any[] = []
    const investigationsPersona: any[] = []

    if (resultsSocieta.length === 0 && resultsLegali.length === 0) {
        return {
            investigationsSocieta,
            investigationsPersona
        }
    }

    if (resultsSocieta.length >0 && resultsSocieta[0].tipologia_indagine?.length) {

        const singleResultSocieta = resultsSocieta[0]

        var jsonCoparti: any = {
            name: '',
            copartiTaxCode: '',
            address: '',
        };

        var jsonControparti: any = {
            controparteTaxCode: '',
        };

        if (singleResultSocieta.coparti) {
            jsonCoparti.name = (singleResultSocieta.coparti[0]?.nome + ' ' + singleResultSocieta.coparti[0]?.cognnome)?.trim() || '';
            jsonCoparti.copartiTaxCode = singleResultSocieta.coparti[0]?.codice_fiscale?.trim() || '';
            jsonCoparti.address = (singleResultSocieta.coparti[0]?.toponimo || '' + ' ' + singleResultSocieta.coparti[0]?.via + ', ' + singleResultSocieta.coparti[0]?.civico + ' ' + singleResultSocieta.coparti[0]?.comune + ' (' + singleResultSocieta.coparti[0]?.provincia + ')')?.trim() || '';
        }

        if (singleResultSocieta.controparti) {
            jsonControparti.controparteTaxCode = singleResultSocieta.controparti[0]?.codice_fiscale?.trim() || '';
            jsonControparti.controparteDenominazione = singleResultSocieta.controparti[0]?.denominazione?.trim() || '';
        }

        investigationsSocieta.push({
            title: singleResultSocieta.tipologia_indagine?.trim() || '',
            registration: singleResultSocieta.data_registrazione?.trim() || '',
            declaredValue: singleResultSocieta.valore_dichiarato,
            name: jsonCoparti.name,
            copartiTaxCode: jsonCoparti.copartiTaxCode,
            dateOfBirthday: '',
            address: jsonCoparti.address,
            controparteTaxCode: jsonControparti.controparteTaxCode,
            municipalityOfBirth: ''
        })
    }

    if (resultsLegali.length >0 && resultsLegali[0].tipologia_indagine?.length) {
        
        const singleResultLegali = resultsLegali[0]

        var jsonCoparti: any = {
            name: '',
            copartiTaxCode: '',
            address: '',
        };

        var jsonControparti: any = {
            controparteTaxCode: '',
        };

        if (singleResultLegali.coparti) {
            jsonCoparti.name = (singleResultLegali.coparti[0]?.nome + ' ' + singleResultLegali.coparti[0]?.cognnome)?.trim() || '';
            jsonCoparti.copartiTaxCode = singleResultLegali.coparti[0]?.codice_fiscale?.trim() || '';
            jsonCoparti.address = (singleResultLegali.coparti[0]?.toponimo || '' + ' ' + singleResultLegali.coparti[0]?.via + ', ' + singleResultLegali.coparti[0]?.civico + ' ' + singleResultLegali.coparti[0]?.comune + ' (' + singleResultLegali.coparti[0]?.provincia + ')')?.trim() || '';
        }

        if (singleResultLegali.controparti) {
            jsonControparti.controparteTaxCode = singleResultLegali.controparti[0]?.codice_fiscale?.trim() || '';
            jsonControparti.controparteDenominazione = singleResultLegali.controparti[0]?.denominazione?.trim() || '';
        }

        investigationsPersona.push({
            title: singleResultLegali.tipologia_indagine?.trim() || '',
            registration: singleResultLegali.data_registrazione?.trim() || '',
            declaredValue: singleResultLegali.valore_dichiarato,
            name: jsonCoparti.name,
            copartiTaxCode: jsonCoparti.copartiTaxCode,
            dateOfBirthday: '',
            address: jsonCoparti.address,
            controparteTaxCode: jsonControparti.controparteTaxCode,
            municipalityOfBirth: ''
        })
    }
    return {
        investigationsSocieta,
        investigationsPersona
    }
}

//Converter Response Query Investigation_record for Veicoli
export function convertVeicoli(results: any) {
    const vehiclesSocieta: Veicolo[] = []
    const vehiclesPersona: Veicolo[] = []

    const noteSocieta = results[0]?.societa__note || ''
    const unworkedVehiclesSocieta = noteSocieta?.split("|")[2] || ''
    const arrayOfVehiclesSocieta = unworkedVehiclesSocieta?.split('\n');
    arrayOfVehiclesSocieta?.forEach((vehicle: string) => {
        if (vehicle.length) {
            const regex = new RegExp("\\b(" + wordsToReplaceVehicles.join("|") + ")\\b", "gi");
            const vehiclePartialReplaced = vehicle.replace(regex, '|');
            const workedVehicle = vehiclePartialReplaced.replace(/[()]/g, "");
            vehiclesSocieta.push({
                type: workedVehicle?.split("|")[0] || '',
                registrationDate: workedVehicle?.split("|")[1] || '',
                plate: workedVehicle?.split("|")[2] || '',
                frameNumber: workedVehicle?.split("|")[3] || '',
                subjectRole: workedVehicle?.split("|")[4] || '',
                brand: workedVehicle?.split("|")[5] || '',
                model: workedVehicle?.split("|")[6] || '',
            })
        }
    })

    const notePersona = results[0]?.persona_fisica__note || ''
    const unworkedVehiclesPersona = notePersona?.split("|")[2] || ''
    const arrayOfVehiclesPersona = unworkedVehiclesPersona?.split('\n');
    arrayOfVehiclesPersona?.forEach((vehicle: string) => {
        if (vehicle.length) {
            const regex = new RegExp("\\b(" + wordsToReplaceVehicles.join("|") + ")\\b", "gi");
            const vehiclePartialReplaced = vehicle.replace(regex, '|');
            const workedVehicle = vehiclePartialReplaced.replace(/[()]/g, "");
            vehiclesPersona.push({
                type: workedVehicle?.split("|")[0] || '',
                registrationDate: workedVehicle?.split("|")[1] || '',
                plate: workedVehicle?.split("|")[2] || '',
                frameNumber: workedVehicle?.split("|")[3] || '',
                subjectRole: workedVehicle?.split("|")[4] || '',
                brand: workedVehicle?.split("|")[5] || '',
                model: workedVehicle?.split("|")[6] || '',
            })
        }
    })
    return {
        vehiclesSocieta,
        vehiclesPersona
    }
}
//

export async function getInvestigationRecordsBySubjectLegalForm(pgConnection: Sequelize, investigation_record_id: string) {
    try {
        let investigationRecords: InvestigationRecords = {
            contiCorrenti: [],
            recapitiTelefonici: [],
            veicoli: {
                vehiclesPersona: [],
                vehiclesSocieta: []
            },
            giudizioRecuperabilita: "",
            operativita: "",
            approfondimentiIpotecari: "",
            indaginiNegoziali: {
                investigationsSocieta: [],
                investigationsPersona: []
            },
            residenze: [],
            domicilio: {},
            erediAccettanti: [],
            erediChiamati: []
        }
        //Query Recapiti Telefonici
        const [resultRecapitiTelefoniciSrl, metadataRecapitiTelefoniciSrl] = await pgConnection.query(generateQueryRecapitiTelefonici(investigation_record_id));
        if (resultRecapitiTelefoniciSrl.length) investigationRecords.recapitiTelefonici = convertRecapitiTelefonici(resultRecapitiTelefoniciSrl)
        //Query Conti Correnti
        const [resultContiCorrentiSrl, metadataContiCorrentiSrl] = await pgConnection.query(generateQueryContiCorrenti(investigation_record_id));
        if (resultContiCorrentiSrl.length) investigationRecords.contiCorrenti = convertContiCorrenti(resultContiCorrentiSrl)
        //Query eredi accettant
        const [resultErediAccettanti, metadataErediAccettanti] = await pgConnection.query(generateQueryErediAccettanti(investigation_record_id));
        if (resultErediAccettanti.length) investigationRecords.erediAccettanti = await convertErediAccettanti(resultErediAccettanti)
        //Query eredi chiamati
        const [resultErediChiamati, metadataErediChiamati] = await pgConnection.query(generateQueryErediChiamati(investigation_record_id));
        if (resultErediChiamati.length) investigationRecords.erediChiamati = await convertErediChiamati(resultErediChiamati)
        //BLOCCHI DA TABELLA INVESTIGATION RECORD
        const [resultInvestigationRecordSrl, metadataInvestigationRecordSrl] = await pgConnection.query(generateQueryInvestigationRecords(investigation_record_id));
        const [resultLocazioniRappLegale, metadataLocazioniRappLegale] = await pgConnection.query(generateQueryLocazioniRappLegaliRecords(investigation_record_id));
        const [resultLocazioni, metadataLocazioni] = await pgConnection.query(generateQueryLocazioniRecords(investigation_record_id));
        if (resultInvestigationRecordSrl.length) {
            investigationRecords.giudizioRecuperabilita = convertGiudizioRecuperabilita(resultInvestigationRecordSrl)
            investigationRecords.operativita = converterOperativita(resultInvestigationRecordSrl)
            investigationRecords.indaginiNegoziali = converterIndaginiNegozialiPersonaGiuridica(resultLocazioni, resultLocazioniRappLegale)
            investigationRecords.veicoli = convertVeicoli(resultInvestigationRecordSrl)
            investigationRecords.residenze = convertResidences(resultInvestigationRecordSrl)
            investigationRecords.approfondimentiIpotecari = converterApprofondimentiIpotecari(resultInvestigationRecordSrl)
            investigationRecords.domicilio = convertDomicilio(resultInvestigationRecordSrl)
        }
        return investigationRecords

    } catch (error) {
        console.error(error);
        await executionJob.error((error as CustomError).message);
        return false

    }
}

export function returnArrayOfAttractiveMembers(legalFormDescription: string) {
    if (
        legalFormDescription === "S.n.c" ||
        legalFormDescription === "S.a.s" ||
        legalFormDescription === "S.s"
    ) {
        return true
    } else return false
}

export async function getRecapitiTelefonici(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultRecapitiTelefoniciSrl, metadata] = await pgConnection.query(generateQueryRecapitiTelefonici(investigation_record_id));
        if (resultRecapitiTelefoniciSrl.length) {
            return convertRecapitiTelefonici(resultRecapitiTelefoniciSrl)
        }
        return []
    } catch (error) {
        console.error(error)
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

export async function getNoteTelefonici(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultRecapitiTelefoniciSrl, metadata] = await pgConnection.query(generateQueryRecapitiTelefonici(investigation_record_id,1));
        if (resultRecapitiTelefoniciSrl.length) {
            return convertRecapitiTelefonici(resultRecapitiTelefoniciSrl)
        }
        return []
    } catch (error) {
        console.error(error)
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

export async function getNoteTelefoniciRappresentante(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultRecapitiTelefoniciSrl, metadata] = await pgConnection.query(generateQueryRecapitiTelefoniciRappresentati(investigation_record_id,1));
        if (resultRecapitiTelefoniciSrl.length) {
            return convertRecapitiTelefonici(resultRecapitiTelefoniciSrl)
        }
        return []
    } catch (error) {
        console.error(error)
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

export async function getRecapitiTelefoniciRappresentante(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultRecapitiTelefoniciSrl, metadata] = await pgConnection.query(generateQueryRecapitiTelefoniciRappresentati(investigation_record_id));
        if (resultRecapitiTelefoniciSrl.length) {
            return convertRecapitiTelefonici(resultRecapitiTelefoniciSrl)
        }
        return []
    } catch (error) {
        console.error(error)
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

export async function getReperibilita(investigation_record_id: string, pgConnection: Sequelize, anagrafica?: AnagraficaPersonaFisica) {
    const result: string[] = []
    let isReperibilita = false;
    try {
        const [resultRecapitiTelefoniciSrl, metadata] = await pgConnection.query(generateQueryReperibilita(investigation_record_id));
        if (resultRecapitiTelefoniciSrl.length) {
            resultRecapitiTelefoniciSrl?.forEach((element: any) => {
                let indirizzo_note = element.note || '';
                let indirizzo_toponimo = element.indirizzo_toponimo || '';
                let indirizzo_via = element.indirizzo_via || '';
                let indirizzo_cap = element.indirizzo_cap === null ? '' : `-${element.indirizzo_cap}`;
                let indirizzo_civico = element.indirizzo_civico || '';
                let indirizzo_comune = element.indirizzo_comune || '';
                let indirizzo_provincia = element.indirizzo_provincia === null ? '' : `(${element.indirizzo_provincia})`;
                if (!(indirizzo_via === null || indirizzo_via === '')) {
                    isReperibilita = true
                    result.push(`IL RICHIESTO RISULTA DOMICILIARE IN ${indirizzo_toponimo} ${indirizzo_via} ${indirizzo_civico} ${indirizzo_cap} ${indirizzo_comune} ${indirizzo_provincia}`)
                } else {
                    let reperibilita = `${indirizzo_note}`;
                    result.push(reperibilita)
                    if (anagrafica && anagrafica.isIrreperibile) {
                        result.push((anagrafica.nota as string))
                    }
                    return { reperibilita: result, isReperibilita: false };
                }
            })
        } else {
            if (anagrafica && anagrafica.isIrreperibile) {
                result.push((anagrafica.nota as string))
            } else if (anagrafica?.address.trim()) {
                result.push(`IL RICHIESTO RISULTA DOMICILIARE IN ${anagrafica.address} ${anagrafica.municipality} (${anagrafica.province})`)
                return { reperibilita: result, isReperibilita: true };
            }
            return { reperibilita: result, isReperibilita: false };
        }
        return { reperibilita: result, isReperibilita: isReperibilita }
    } catch (error) {
        await executionJob.error((error as CustomError).message);
        return { reperibilita: null, isReperibilita: false };
    }
}

export async function getDetailsReperibilita(investigation_record_id: string, pgConnection: Sequelize) {
    const [resultRecapitiTelefoniciSrl, metadata] = await pgConnection.query(generateQueryReperibilita(investigation_record_id)) as any;
    return {
        toponimo: resultRecapitiTelefoniciSrl[0]?.indirizzo_toponimo || '',
        via: resultRecapitiTelefoniciSrl[0]?.indirizzo_via || '',
        civico: resultRecapitiTelefoniciSrl[0]?.indirizzo_civico || '',
        cap: resultRecapitiTelefoniciSrl[0]?.indirizzo_cap || '',
        comune: resultRecapitiTelefoniciSrl[0]?.indirizzo_comune || '',
        provincia: resultRecapitiTelefoniciSrl[0]?.indirizzo_provincia || ''
    }
}

export async function getIndaginiNegoziali(investigation_record_id: string, pgConnection: Sequelize) {
    //const [resultInvestigationRecord, metadata] = await pgConnection.query(generateQueryInvestigationRecords(investigation_record_id));
    //const indaginiNegoziali = converterIndaginiNegozialiPersonaFisica(resultInvestigationRecord)
    const [resultInvestigationRecord, metadataLocazioni] = await pgConnection.query(generateQueryLocazioniRecords(investigation_record_id));
    const indaginiNegoziali = converterIndaginiNegoziali(resultInvestigationRecord)
    return indaginiNegoziali.investigationsPersona
}

export async function getVeicoli(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultPRA, metadata] = await pgConnection.query(generateQueryPRA(investigation_record_id)) as any;
        const resultVehicles: Pra[] = []

        resultPRA?.forEach((vehicle: any) => {
            if (Object.entries(vehicle).length) {
                resultVehicles.push({
                    brand: vehicle.marca?.trim() || '',
                    type: vehicle.serie_targa?.trim() || '',
                    registrationDate: vehicle.prima_immatricolazione?.trim() || '',
                    plate: vehicle.targa?.trim() || '',
                    frameNumber: vehicle.telaio?.trim() || '',
                    subjectRole: vehicle.ruolo_soggetto?.trim() || '',
                    model: vehicle.modello?.trim() || '',
                    series: vehicle.serie?.trim() || '',
                    typeVehicle: vehicle.tipologia_veicolo?.trim() || '',
                    roleDate: vehicle.data_rif_ruolo?.trim() || '',
                    provinceComp: vehicle.provincia_competenza?.trim() || ''
                })
            }
        })
        return resultVehicles
    } catch (error) {
        console.error(error)
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

export async function getVeicoliLegalRappr(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultPRA, metadata] = await pgConnection.query(generateQueryPRARapprLegal(investigation_record_id)) as any;
        const resultVehicles: Pra[] = []

        resultPRA?.forEach((vehicle: any) => {
            if (Object.entries(vehicle).length) {
                resultVehicles.push({
                    brand: vehicle.marca?.trim() || '',
                    type: vehicle.serie_targa?.trim() || '',
                    registrationDate: vehicle.prima_immatricolazione?.trim() || '',
                    plate: vehicle.targa?.trim() || '',
                    frameNumber: vehicle.telaio?.trim() || '',
                    subjectRole: vehicle.ruolo_soggetto?.trim() || '',
                    model: vehicle.modello?.trim() || '',
                    series: vehicle.serie?.trim() || '',
                    typeVehicle: vehicle.tipologia_veicolo?.trim() || '',
                    roleDate: vehicle.data_rif_ruolo?.trim() || '',
                    provinceComp: vehicle.provincia_competenza?.trim() || ''
                })
            }
        })
        return resultVehicles
    } catch (error) {
        console.error(error)
        await executionJob.error((error as CustomError).message);
        return false;
    }
}


export async function getBankingRelationshipsLegalRepresentative(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultRelationshipLegal, metadata] = await pgConnection.query(generateQueryRapportiBancariLegaleRappresentante(investigation_record_id)) as any;
        const resultRelationship: BankingRelationshipsLegalRepresentative[] = []

        resultRelationshipLegal?.forEach((res: any) => {
            if (Object.entries(res).length) {
                resultRelationship.push({
                    notes: res.note || '',
                    present: res.presente || '',
                    bankCompanyName: res.ragione_sociale_banca || '',
                    bankVATNumber: res.partita_iva_banca || '',
                    toponymAddress: res.indirizzo_toponimo || '',
                    streetAddress: res.indirizzo_via || '',
                    civicAddress: res.indirizzo_civico || '',
                    addressAt: res.indirizzo_presso || '',
                    commonAddress: res.indirizzo_comune || '',
                    postalAddress: res.indirizzo_cap || '',
                    provinceAddress: res.indirizzo_provincia || '',
                    stateAddress: res.indirizzo_stato || '',
                    abi: res.abi || '',
                    cab: res.cab || '',
                    active: res.attivo || '',
                    protest: res.protesti || '',
                    collectedAt: res.collectedAt || '',
                    address: `${res.indirizzo_toponimo || ''} ${res.indirizzo_via || ''} ${res.indirizzo_civico || ''} - ${res.indirizzo_cap || ''} ${res.indirizzo_comune || ''} ${res.indirizzo_provincia ? `(${res.indirizzo_provincia})` : ''}`,

                })
            }
        })
        return resultRelationship
    } catch (error) {
        console.error(error)
        await executionJob.error((error as CustomError).message);
        return false;
    }
}


export async function getPrejudical(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultPrejudical, metadata] = await pgConnection.query(generateQueryPrejudical(investigation_record_id)) as any;
        const result: descriptionPrejudicial[] = []

        resultPrejudical?.forEach((res: any) => {
            if (Object.entries(res).length) {
                result.push({
                    title: res.descrizione_titolo,
                    conservatory: res.pubblico_ufficiale,
                    actDate: res.data_stipulazione,
                    generalNumberDetail: res.specie_atto,
                    actCode: res.codice_atto,
                    amount: res.importo_iscritto,
                    guaranteedAmount: res.importo_garantito,
                    subjectAgainst: {
                        name: res.soggetto_contro,
                        taxCode: res.codice_fiscale,
                    },
                    subjectFavour: res.soggetto_favore

                })
            }
        })
        return result
    } catch (error) {
        console.error(error)
        await executionJob.error((error as CustomError).message);
        return false;
    }
}


export async function getApprofondimentiIpotecari(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultApprofondimenti, metadata] = await pgConnection.query(generateQueryApprofondimentiIpotecari(investigation_record_id)) as any;

        if (resultApprofondimenti.length && resultApprofondimenti[0].approfondimento_ipotecario__note) {
            return resultApprofondimenti[0].approfondimento_ipotecario__note;
        } else {
            return "";
        }
    } catch (error) {
        console.error(error)
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

export async function getApprofondimentiIpotecariRapprLegale(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultApprofondimentiRapprLegale, metadata] = await pgConnection.query(generateQueryApprofondimentiIpotecariRapprLegale(investigation_record_id)) as any;

        if (resultApprofondimentiRapprLegale.length && resultApprofondimentiRapprLegale[0].approfondimento_ipotecario_rappr_legale__note) {
            return resultApprofondimentiRapprLegale[0].approfondimento_ipotecario_rappr_legale__note;
        } else {
            return "";
        }
    } catch (error) {
        console.error(error)
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

export async function getOperativitaSocieta(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultOperativitaSocieta, metadata] = await pgConnection.query(generateQueryOperativitaSocieta(investigation_record_id)) as any;

        if (resultOperativitaSocieta.length && resultOperativitaSocieta[0].operativita_societa__note) {
            return resultOperativitaSocieta[0].operativita_societa__note;
        } else {
            return [];
        }
    } catch (error) {
        console.error(error)
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

export async function getNoteDaConservatoria(codice_fiscale: string, pgConnection: Sequelize) {
    try {
        const [resultNote, metadata] = await pgConnection.query(generateQueryNoteConservatoriaByCodiceFiscale(codice_fiscale)) as any;
        if (resultNote.length && resultNote[0].note_da_conservatoria) {
            return resultNote[0].note_da_conservatoria;
        } else {
            return "";
        }
    } catch (error) {
        console.error(error)
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

export function splittaNotaConservatoria(notaconservatoria: string) {
    if (notaconservatoria !== '' || notaconservatoria) {
        let notaConservatoriaSplitted: string[] = notaconservatoria.split('\r\n');
        let campiNota = new Array<{
            key: string,
            value: string
        }>;
        notaConservatoriaSplitted.forEach((campoNota: string) => {
            if (campoNota !== notaConservatoriaSplitted[0]) {

                let splittedCampo = campoNota.split("-")
                campiNota.push(
                    {
                        key: splittedCampo[0].toUpperCase(),
                        value: splittedCampo[1]
                    }
                )
            }
        })
        return {
            accettazione: notaConservatoriaSplitted[0],
            campiNota: campiNota
        }
    } else {
        return ''
    }
}

export async function getRapportiBancari(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultContiCorrenti, metadata] = await pgConnection.query(generateQueryContiCorrenti(investigation_record_id));
        const rapportiBancari = await convertContiCorrenti(resultContiCorrenti)
        return rapportiBancari
    } catch (error) {
        console.error(error)
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

export async function getRapportiBancariRappresentanteLegale(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultContiCorrenti, metadata] = await pgConnection.query(generateQueryRapportiBancariLegaleRappresentante(investigation_record_id));
        const rapportiBancari = await convertContiCorrenti(resultContiCorrenti)
        return rapportiBancari
    } catch (error) {
        console.error(error)
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

export async function getGiudizioRecuperabilita(investigation_record_id: string, pgConnection: Sequelize) {
    const [resultGiudizioRecuperabilita, metadata] = await pgConnection.query(generateQueryProprieta(investigation_record_id));
    const giudizioRecuperabilita = convertGiudizioRecuperabilita(resultGiudizioRecuperabilita)
    return giudizioRecuperabilita
}

export async function getAnagraficaPersonaFisica(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultAnagrafica, metadata] = await pgConnection.query(generateQueryPersonaFisica(investigation_record_id));
        const anagrafica = convertAnagraficaPersonaFisica(resultAnagrafica)
        return anagrafica
    } catch (error) {
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

export async function getAnagraficaImpresa(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultAnagrafica, metadata] = await pgConnection.query(generateQueryPersonaFisica(investigation_record_id));
        console.log('sto prendendo anagrafica impresa')
        const anagraficaImpresa = convertAnagraficaImpresa(resultAnagrafica)
        return anagraficaImpresa
    } catch (error) {
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

export async function getLegaleRappresentante(investigation_record_id: string, domicilio: any, pgConnection: Sequelize) {
    try {
        const [resultLegale, metadata] = await pgConnection.query(generateQueryLegaleRappresentante(investigation_record_id));
        const legaleRappresentante = convertLegaleRappresentante(resultLegale, domicilio)
        return legaleRappresentante
    } catch (error) {
        await executionJob.error((error as CustomError).message);
        return convertLegaleRappresentante([], domicilio);
    }
}

function convertLegaleRappresentante(resultsQuery: any[], domicilio: any) {
    var strToponimo: string = domicilio?.toponimo || '';
    if (resultsQuery.length) {
        return {
            surname: resultsQuery[0].cognome || '',
            lastName: resultsQuery[0].cognome || '',
            name: resultsQuery[0].nome || '',
            firstName: resultsQuery[0].nome || '',
            cf: resultsQuery[0].codice_fiscale || '',
            taxIdCode: resultsQuery[0].codice_fiscale || '',
            dateOfBirth: extractBirthDay('', resultsQuery[0].codice_fiscale),
            placeOfBirth: extractPlaceOfBirth('', resultsQuery[0].codice_fiscale),
            provinceOfBirth: extractProvinceOfBirth('', resultsQuery[0].codice_fiscale),
            address: resultsQuery[0].indirizzo_via || '',
            cap: resultsQuery[0].indirizzo_cap || '',
            municipality: resultsQuery[0].indirizzo_comune || '',
            province: resultsQuery[0].indirizzo_provincia || '',
            livingAddress: `${strToponimo} ${domicilio?.via} ${domicilio?.civico}` || '',
            provinceCode: resultsQuery[0].indirizzo_provincia || '',
            toponym: resultsQuery[0].indirizzo_toponimo || '',
            streetName: resultsQuery[0].indirizzo_via || '',
            streetNumber: resultsQuery[0].indirizzo_civico || '',
            postCode: resultsQuery[0].indirizzo_cap || '',
            livingCap: domicilio?.cap || '',
            livingMunicipality: domicilio?.comune || '',
            livingProvince: domicilio?.provincia || ''
        }
    } else {
        return {
            surname: '',
            name: '',
            cf: '',
            dateOfBirth: '',
            placeOfBirth: '',
            provinceOfBirth: '',
            address: '',
            cap: '',
            municipality: '',
            province: '',
            livingAddress: `${strToponimo} ${domicilio?.via} ${domicilio?.civico}`,
            livingCap: domicilio?.cap,
            livingMunicipality: domicilio?.comune,
            livingProvince: domicilio?.provincia
        }
    }
}

function convertAnagraficaImpresa(resultsQuery: any[]) {
    if (resultsQuery.length && resultsQuery[0].societa__partita_iva && resultsQuery[0].societa__partita_iva !== '') {
        var strToponimo: string = resultsQuery[0]?.societa__indirizzo_toponimo || '';
        return {
            businessName: resultsQuery[0]?.societa__ragione_sociale || '',
            taxCode: resultsQuery[0]?.societa__partita_iva || '',
            iva: resultsQuery[0]?.societa__partita_iva || '',
            codeREA: resultsQuery[0]?.societa__cciaa || '',
            site: `${strToponimo} ${resultsQuery[0]?.societa__indirizzo_via || ''} ${resultsQuery[0]?.societa__indirizzo_civico || ''} ${resultsQuery[0]?.societa__indirizzo_cap} ${resultsQuery[0]?.societa__indirizzo_comune || ''} ${resultsQuery[0]?.societa__indirizzo_provincia || ''} `,
            address: `${resultsQuery[0]?.societa__indirizzo_toponimo || ''} ${resultsQuery[0]?.societa__indirizzo_via || ''} ${resultsQuery[0]?.societa__indirizzo_civico || ''}`,
            cap: `${resultsQuery[0]?.societa__indirizzo_cap || ''}`,
            municipality: `${resultsQuery[0]?.societa__indirizzo_comune || ''}`,
            province: `${resultsQuery[0]?.societa__indirizzo_provincia || ''}`,
            legalForm: resultsQuery[0]?.societa__natura_giuridica || '',
            stateOfCompany: resultsQuery[0]?.societa__status || '',
            startCompanyDate: resultsQuery[0]?.societa__data_inizio_attivita?.length ? moment(resultsQuery[0]?.societa__data_inizio_attivita).format("DD/MM/YYYY") : '',
            socialCapital: new Intl.NumberFormat('de-DE').format(resultsQuery[0]?.societa__capitale_sociale || 0) || '',
            activity: resultsQuery[0]?.societa__codice_ateco || '',
            siteName: resultsQuery[0]?.societa__indirizzo_comune || '',
            //chiesto da AZ di lasciare vuoto , NOREA non c'é l hanno
            raeCode: '',
            saeCode: '',
            section: '',
            naceCode: '',
            certifiedEmail: resultsQuery[0]?.societa__pec || '',
            dateIncorporation: resultsQuery[0]?.societa__data_costituzione?.length ? moment(resultsQuery[0]?.societa__data_costituzione).format("DD/MM/YYYY") : '',
            expectedEndDate: resultsQuery[0]?.societa__data_cessazione_liquidazione || '',
            legalFormType: resultsQuery[0]?.societa__tipo || '',
            societaAttiva: resultsQuery[0]?.societa_attiva || false,
        }

    }
    else {
        return false
    }
}

export function convertAnagraficaPersonaFisica(resultsQuery: any[]) {
    let anagrafica = {
        surname: resultsQuery.length ? resultsQuery[0]?.cognome || '' : '',
        name: resultsQuery.length ? resultsQuery[0]?.nome || '' : '',
        cf: resultsQuery.length ? resultsQuery[0]?.codice_fiscale || '' : '',
        dateOfBirth: resultsQuery.length && resultsQuery[0]?.persona_fisica__data_nascita != null && resultsQuery[0]?.persona_fisica__data_nascita != '' ? moment(new Date(resultsQuery[0]?.persona_fisica__data_nascita)).format('DD/MM/YYYY') : '',
        placeOfBirth: resultsQuery.length ? resultsQuery[0]?.persona_fisica__comune_nascita || '' : '',
        provinceOfBirth: resultsQuery.length ? resultsQuery[0]?.persona_fisica__provincia_nascita || '' : '',
        address: resultsQuery.length ? `${resultsQuery[0]?.residenza__indirizzo_toponimo || ''} ${resultsQuery[0]?.residenza__indirizzo_via || ''} ${resultsQuery[0]?.residenza__indirizzo_civico || ''}` : '',
        cap: resultsQuery.length ? resultsQuery[0]?.residenza__indirizzo_cap || '' : '',
        municipality: resultsQuery.length ? resultsQuery[0]?.residenza__indirizzo_comune || '' : '',
        province: resultsQuery.length ? resultsQuery[0]?.residenza__indirizzo_provincia || '' : '',
        nota: resultsQuery.length ? resultsQuery[0]?.residenza__note || '' : '',
        isIrreperibile: resultsQuery.length ? resultsQuery[0]?.residenza__irreperibile || '' : ''
    } as AnagraficaPersonaFisica
    try {
        console.error(anagrafica)
        const codiceFiscale = new CodiceFiscale(anagrafica.cf);
        anagrafica.dateOfBirth = anagrafica.dateOfBirth != '' ? anagrafica.dateOfBirth : moment(codiceFiscale.birthday).format('DD/MM/YYYY'),
            anagrafica.placeOfBirth = anagrafica.placeOfBirth != '' ? anagrafica.placeOfBirth : codiceFiscale.birthplace.nome,
            anagrafica.provinceOfBirth = anagrafica.provinceOfBirth != '' ? anagrafica.provinceOfBirth : codiceFiscale.birthplace.prov
    }
    catch (error) {
        console.error("Codice fiscale non corretto", anagrafica.cf)
    }
    return anagrafica;
}

export function converterIndaginiNegozialiPersonaFisica(resultsQuery: any[]) {
    const persona_fisica__note = resultsQuery[0]?.persona_fisica__note || ''
    const personaFisicaInvestigations = persona_fisica__note?.split("|")[1] || ''
    const arrayOfPersonaFisicaInvestigations = ['NON SI RILEVANO CANONI DI LOCAZIONE', 'NON SI RILEVANO INDAGINI NEGOZIALI'].includes(personaFisicaInvestigations) ? [] : personaFisicaInvestigations?.split('\n');
    const investigations: any[] = []
    if (arrayOfPersonaFisicaInvestigations[0]?.length) {
        arrayOfPersonaFisicaInvestigations?.forEach((element: string) => {
            if (element.length) {
                const regex = new RegExp("\\b(" + wordsToReplaceInvestigation.join("|") + ")\\b", "gi");
                const investigationPartialReplaced = element.replace(regex, '');
                const partOfInvestigations = investigationPartialReplaced?.split(';');
                investigations.push({
                    title: partOfInvestigations[4]?.trim() || '',
                    registration: partOfInvestigations[3]?.trim() || '',
                    declaredValue: partOfInvestigations[5]?.trim() || '',
                    name: partOfInvestigations[0]?.trim() || '',
                    copartiTaxCode: partOfInvestigations[1]?.trim() || '',
                    dateOfBirthday: '',
                    address: partOfInvestigations[2]?.trim() || '',
                    controparteTaxCode: partOfInvestigations[7]?.trim() || '',
                    municipalityOfBirth: ''
                })
            }
        });
    }
    return investigations
}

export function convertAttivitaLavorativa(resultsQuery: any[], businessName?: string) {
    const result: any[] = []
    resultsQuery?.forEach((element: any) => {
        element.tipologia !== 'Imprenditore / Libero professionista' ?
            result.push({
                jobTitle: element.tipologia || '',
                jobType: element.tipologia_contratto || '',
                startJob: element.data_inizio ? moment(element.data_inizio).format('DD/MM/YYYY') : '',
                remunerationNet: element.importo_mensile_netto || 0,
                remunerationGross: element.importo_mensile_lordo || 0,
                ownerName: element.ragione_sociale_datore || '',
                ownerCf: element.codice_fiscale_datore ? element.codice_fiscale_datore : element.partita_iva_datore ? element.partita_iva_datore : '',
                ownerPhone: element.telefono_sede_legale || '',
                ownerPhone2: element.telefono2_sede_legale || '',
                ownerLegalSite: element.indirizzo_legale_via ? `${element.indirizzo_legale_toponimo} ${element.indirizzo_legale_via} ${element.indirizzo_legale_civico} - ${element.indirizzo_legale_cap} ${element.indirizzo_legale_comune} ${element.indirizzo_legale_provincia ? `(${element.indirizzo_legale_provincia})` : ''}` : '',
                verificationNote: element.note || '',
                indirizzo: `${element.indirizzo_ente_toponimo} ${element.indirizzo_ente_via} ${element.indirizzo_ente_civico}`,
                cap: element.indirizzo_ente_cap,
                comune: element.indirizzo_ente_comune,
                provincia: element.indirizzo_ente_provincia,
            })
            : result.push({
                jobTitle: element.tipologia || '',
                businessName,
                verificationNote: element.note || ''
            })
    })
    return result
}

export function convertPensioni(resultsQuery: any[]) {
    const result: any[] = []
    resultsQuery?.forEach((element: any) => {

        result.push({
            type: element.tipologia || '',
            entityCompanyName: element.ragione_sociale_ente || '',
            effectiveDate: element.data_decorrenza ? moment(new Date(element.data_decorrenza)).format("DD/MM/YYYY") : '',
            remunerationNet: element.importo_mensile_netto || 0,
            remunerationGross: element.importo_mensile_lordo || 0,
            ivaCodeCompanyName: element.partita_iva_ente || '',
            taxCodeCompanyName: element.codice_fiscale_ente || '',
            companyLegalSite: `${element.indirizzo_ente_toponimo || ''} ${element.indirizzo_ente_via || ''} ${element.indirizzo_ente_civico || ''} - ${element.indirizzo_ente_cap || ''} ${element.indirizzo_ente_comune || ''} ${element.indirizzo_ente_provincia ? `(${element.indirizzo_ente_provincia})` : ''}`,
            indirizzo: `${element.indirizzo_ente_toponimo} ${element.indirizzo_ente_via} ${element.indirizzo_ente_civico}`,
            cap: element.indirizzo_ente_cap,
            comune: element.indirizzo_ente_comune,
            provincia: element.indirizzo_ente_provincia,
        })
    })
    return result
}

export async function getAttivitaLavorativa(investigation_record_id: string, pgConnection: Sequelize, businessName?: string) {
    try {
        const [resultQueryAttivita, metadataAttivita] = await pgConnection.query(generateQueryAttivitaLavorativa(investigation_record_id));
        const [resultQueryPensioni, metadataPensioni] = await pgConnection.query(generateQueryPensioni(investigation_record_id));
        const resultPension = convertPensioni(resultQueryPensioni)
        const resultActivityJob = convertAttivitaLavorativa(resultQueryAttivita, businessName)
        return {
            pension: resultPension,
            activityJob: resultActivityJob,
            freelancer: resultActivityJob.filter(x => x.jobTitle === 'Imprenditore / Libero professionista') ? true : false,
            isWorker: !((resultActivityJob.filter(x => !x.jobTitle || x.jobTitle === '' || x.jobTitle === 'Deceduto' || x.jobTitle === 'Disoccupato').length) === resultActivityJob.length)
        }
    } catch (error) {
        console.error(error)
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

export async function getCaricheInImprese(representativesSection: any) {
    //Cariche Attuali - ActivePositions + SecondaryPositions //Cariche Pregresse
    const activePositions: any[] = []
    const pastPositions: any[] = []
    //attive
    if (Array.isArray(representativesSection?.ActivePositions?.Company)) {
        representativesSection?.ActivePositions?.Company?.forEach((company: any) => {
            //se la società è stata cancellata seppure la carica rimane attiva dev'essere aggiunta alle pregresse
            const isDeleted = company?.ActivityStatus?.CancellationDate?._text ? true : false
            if (company?.Positions?.Position && Array.isArray(company?.Positions?.Position)) {
                company?.Positions?.Position?.forEach((position: any) => {
                    if (isDeleted) {
                        pastPositions.push({
                            position: position?.Description?._text || '',
                            legalForm: company?.Form?._text || '',
                            taxCode: company?.TaxCode?._text || '',
                            companyName: company?.Name?._text || '',
                            site: `${company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                            rea: company?.REACode?._text || '',
                            province: company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                            status: company?.ActivityStatus?.Description?._text || '',
                            startDate: position.StartDate?._attributes ? moment(new Date(+position?.StartDate?._attributes?.year, (+position?.StartDate?._attributes?.month - 1), +position?.StartDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                            cancellationDate: company?.ActivityStatus?.CancellationDate?._attributes?.year ? moment(new Date(+company?.ActivityStatus?.CancellationDate?._attributes?.year, (+company?.ActivityStatus?.CancellationDate?._attributes?.month - 1), +company?.ActivityStatus?.CancellationDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                        })
                    } else {
                        activePositions.push({
                            position: position?.Description?._text || '',
                            legalForm: company?.Form?._text || '',
                            taxCode: company?.TaxCode?._text || '',
                            companyName: company?.Name?._text || '',
                            site: `${company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                            rea: company?.REACode?._text || '',
                            province: company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                            status: company?.ActivityStatus?.Description?._text || '',
                        })
                    }
                })
            } else {
                if (isDeleted) {
                    pastPositions.push({
                        position: company?.Positions?.Position?.Description?._text || '',
                        legalForm: company?.Form?._text || '',
                        taxCode: company?.TaxCode?._text || '',
                        companyName: company?.Name?._text || '',
                        site: `${company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                        rea: company?.REACode?._text || '',
                        province: company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                        status: company?.ActivityStatus?.Description?._text || '',
                        startDate: company?.Positions?.Position?.StartDate?._attributes ? moment(new Date(+company?.Positions?.Position?.StartDate?._attributes?.year, (+company?.Positions?.Position?.StartDate?._attributes?.month - 1), +company?.Positions?.Position?.StartDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                        cancellationDate: company?.ActivityStatus?.CancellationDate?._attributes?.year ? moment(new Date(+company?.ActivityStatus?.CancellationDate?._attributes?.year, (+company?.ActivityStatus?.CancellationDate?._attributes?.month - 1), +company?.ActivityStatus?.CancellationDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                    })
                } else {
                    activePositions.push({
                        position: company?.Positions?.Position?.Description?._text || '',
                        legalForm: company?.Form?._text || '',
                        taxCode: company?.TaxCode?._text || '',
                        companyName: company?.Name?._text || '',
                        site: `${company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                        rea: company?.REACode?._text || '',
                        province: company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                        status: company?.ActivityStatus?.Description?._text || '',
                    })
                }
            }
        });
    } else {
        const isDeleted = representativesSection?.ActivePositions?.Company?.ActivityStatus?.CancellationDate?._text ? true : false
        if (representativesSection?.ActivePositions?.Company?.Positions?.Position && Array.isArray(representativesSection?.ActivePositions?.Company?.Positions?.Position)) {
            representativesSection?.ActivePositions?.Company?.Positions?.Position?.forEach((position: any) => {
                if (isDeleted) {
                    pastPositions.push({
                        position: position?.Description?._text || '',
                        legalForm: representativesSection?.ActivePositions?.Company?.Form?._text || '',
                        taxCode: representativesSection?.ActivePositions?.Company?.TaxCode?._text || '',
                        companyName: representativesSection?.ActivePositions?.Company?.Name?._text || '',
                        site: `${representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                        rea: representativesSection?.ActivePositions?.Company?.REACode?._text || '',
                        province: representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                        status: representativesSection?.ActivePositions?.Company?.ActivityStatus?.Description?._text || '',
                    })
                } else {
                    activePositions.push({
                        position: position?.Description?._text || '',
                        legalForm: representativesSection?.ActivePositions?.Company?.Form?._text || '',
                        taxCode: representativesSection?.ActivePositions?.Company?.TaxCode?._text || '',
                        companyName: representativesSection?.ActivePositions?.Company?.Name?._text || '',
                        site: `${representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                        rea: representativesSection?.ActivePositions?.Company?.REACode?._text || '',
                        province: representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                        status: representativesSection?.ActivePositions?.Company?.ActivityStatus?.Description?._text || '',
                    })
                }
            })
        } else if (Object.keys(representativesSection?.ActivePositions?.Company || {}).length) {
            if (isDeleted) {
                pastPositions.push({
                    position: representativesSection?.ActivePositions?.Company?.Positions?.Position?.Description?._text || '',
                    legalForm: representativesSection?.ActivePositions?.Company?.Form?._text || '',
                    taxCode: representativesSection?.ActivePositions?.Company?.TaxCode?._text || '',
                    companyName: representativesSection?.ActivePositions?.Company?.Name?._text || '',
                    site: `${representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                    rea: representativesSection?.ActivePositions?.Company?.REACode?._text || '',
                    province: representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                    status: representativesSection?.ActivePositions?.Company?.ActivityStatus?.Description?._text || '',
                    startDate: representativesSection?.ActivePositions?.Company?.Positions?.Position?.StartDate?._attributes ? moment(new Date(+representativesSection?.ActivePositions?.Company?.Positions?.Position?.StartDate?._attributes?.year, (+representativesSection?.ActivePositions?.Company?.Positions?.Position?.StartDate?._attributes?.month - 1), +representativesSection?.ActivePositions?.Company?.Positions?.Position?.StartDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                    cancellationDate: representativesSection?.ActivePositions?.Company?.ActivityStatus?.CancellationDate?._attributes?.year ? moment(new Date(+representativesSection?.ActivePositions?.Company?.ActivityStatus?.CancellationDate?._attributes?.year, (+representativesSection?.ActivePositions?.Company?.ActivityStatus?.CancellationDate?._attributes?.month - 1), +representativesSection?.ActivePositions?.Company?.ActivityStatus?.CancellationDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                })
            } else {
                activePositions.push({
                    position: representativesSection?.ActivePositions?.Company?.Positions?.Position?.Description?._text || '',
                    legalForm: representativesSection?.ActivePositions?.Company?.Form?._text || '',
                    taxCode: representativesSection?.ActivePositions?.Company?.TaxCode?._text || '',
                    companyName: representativesSection?.ActivePositions?.Company?.Name?._text || '',
                    site: `${representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                    rea: representativesSection?.ActivePositions?.Company?.REACode?._text || '',
                    province: representativesSection?.ActivePositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                    status: representativesSection?.ActivePositions?.Company?.ActivityStatus?.Description?._text || '',
                })
            }
        }
    }
    //secondarie
    if (Array.isArray(representativesSection?.SecondaryPositions?.Company)) {
        representativesSection?.SecondaryPositions?.Company?.forEach((company: any) => {
            const isDeleted = company?.ActivityStatus?.CancellationDate?._text ? true : false
            if (company?.Positions?.Position && Array.isArray(company?.Positions?.Position)) {
                company?.Positions?.Position?.forEach((position: any) => {
                    if (isDeleted) {
                        pastPositions.push({
                            position: position.Description?._text || '',
                            legalForm: company?.Form?._text || '',
                            taxCode: company?.TaxCode?._text || '',
                            companyName: company?.Name?._text || '',
                            site: `${company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                            rea: company?.REACode?._text || '',
                            province: company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                            status: company?.ActivityStatus?.Description?._text || '',
                            startDate: position?.StartDate?._attributes ? moment(new Date(+position?.StartDate?._attributes?.year, (+position?.StartDate?._attributes?.month - 1), +position?.StartDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                            cancellationDate: company?.ActivityStatus?.CancellationDate?._attributes?.year ? moment(new Date(+company?.ActivityStatus?.CancellationDate?._attributes?.year, (+company?.ActivityStatus?.CancellationDate?._attributes?.month - 1), +company?.ActivityStatus?.CancellationDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                        })
                    } else {
                        activePositions.push({
                            position: position.Description?._text || '',
                            legalForm: company?.Form?._text || '',
                            taxCode: company?.TaxCode?._text || '',
                            companyName: company?.Name?._text || '',
                            site: `${company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                            rea: company?.REACode?._text || '',
                            province: company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                            status: company?.ActivityStatus?.Description?._text || '',
                        })
                    }
                })
            } else {
                if (isDeleted) {
                    pastPositions.push({
                        position: company?.Positions?.Position?.Description?._text || '',
                        legalForm: company?.Form?._text || '',
                        taxCode: company?.TaxCode?._text || '',
                        companyName: company?.Name?._text || '',
                        site: `${company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                        rea: company?.REACode?._text || '',
                        province: company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                        status: company?.ActivityStatus?.Description?._text || '',
                        startDate: company?.Positions?.Position?.StartDate?._attributes ? moment(new Date(+company?.Positions?.Position?.StartDate?._attributes?.year, (+company?.Positions?.Position?.StartDate?._attributes?.month - 1), +company?.Positions?.Position?.StartDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                        cancellationDate: company?.ActivityStatus?.CancellationDate?._attributes?.year ? moment(new Date(+company?.ActivityStatus?.CancellationDate?._attributes?.year, (+company?.ActivityStatus?.CancellationDate?._attributes?.month - 1), +company?.ActivityStatus?.CancellationDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                    })
                } else {
                    activePositions.push({
                        position: company?.Positions?.Position?.Description?._text || '',
                        legalForm: company?.Form?._text || '',
                        taxCode: company?.TaxCode?._text || '',
                        companyName: company?.Name?._text || '',
                        site: `${company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                        rea: company?.REACode?._text || '',
                        province: company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                        status: company?.ActivityStatus?.Description?._text || '',
                    })
                }
            }
        });
    } else {
        const isDeleted = representativesSection?.SecondaryPositions?.Company?.ActivityStatus?.CancellationDate?._text ? true : false
        if (representativesSection?.SecondaryPositions?.Company?.Positions?.Position && Array.isArray(representativesSection?.SecondaryPositions?.Company?.Positions?.Position)) {
            representativesSection?.SecondaryPositions?.Company?.Positions?.Position?.forEach((position: any) => {
                if (isDeleted) {
                    pastPositions.push({
                        position: position.Description?._text || '',
                        legalForm: representativesSection?.SecondaryPositions?.Company?.Form?._text || '',
                        taxCode: representativesSection?.SecondaryPositions?.Company?.TaxCode?._text || '',
                        companyName: representativesSection?.SecondaryPositions?.Company?.Name?._text || '',
                        site: `${representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                        rea: representativesSection?.SecondaryPositions?.Company?.REACode?._text || '',
                        province: representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                        status: representativesSection?.SecondaryPositions?.Company?.ActivityStatus?.Description?._text || '',
                        startDate: position?.StartDate?._attributes ? moment(new Date(+position?.StartDate?._attributes?.year, (+position?.StartDate?._attributes?.month - 1), +position?.StartDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                        cancellationDate: representativesSection?.SecondaryPositions?.Company?.ActivityStatus?.CancellationDate?._attributes?.year ? moment(new Date(+representativesSection?.SecondaryPositions?.Company?.ActivityStatus?.CancellationDate?._attributes?.year, (+representativesSection?.SecondaryPositions?.Company?.ActivityStatus?.CancellationDate?._attributes?.month - 1), +representativesSection?.SecondaryPositions?.Company?.ActivityStatus?.CancellationDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                    })
                } else {
                    activePositions.push({
                        position: position.Description?._text || '',
                        legalForm: representativesSection?.SecondaryPositions?.Company?.Form?._text || '',
                        taxCode: representativesSection?.SecondaryPositions?.Company?.TaxCode?._text || '',
                        companyName: representativesSection?.SecondaryPositions?.Company?.Name?._text || '',
                        site: `${representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                        rea: representativesSection?.SecondaryPositions?.Company?.REACode?._text || '',
                        province: representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                        status: representativesSection?.SecondaryPositions?.Company?.ActivityStatus?.Description?._text || '',
                    })
                }
            })
        } else if (Object.keys(representativesSection?.SecondaryPositions?.Company || {}).length) {
            if (isDeleted) {
                pastPositions.push({
                    position: representativesSection?.SecondaryPositions?.Company?.Positions?.Position?.Description?._text || '',
                    legalForm: representativesSection?.SecondaryPositions?.Company?.Form?._text || '',
                    taxCode: representativesSection?.SecondaryPositions?.Company?.TaxCode?._text || '',
                    companyName: representativesSection?.SecondaryPositions?.Company?.Name?._text || '',
                    site: `${representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                    rea: representativesSection?.SecondaryPositions?.Company?.REACode?._text || '',
                    province: representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                    status: representativesSection?.SecondaryPositions?.Company?.ActivityStatus?.Description?._text || '',
                    startDate: representativesSection?.SecondaryPositions?.Company?.Positions?.Position?.StartDate?._attributes ? moment(new Date(+representativesSection?.SecondaryPositions?.Company?.Positions?.Position?.StartDate?._attributes?.year, (+representativesSection?.SecondaryPositions?.Company?.Positions?.Position?.StartDate?._attributes?.month - 1), +representativesSection?.SecondaryPositions?.Company?.Positions?.Position?.StartDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                    cancellationDate: representativesSection?.SecondaryPositions?.Company?.ActivityStatus?.CancellationDate?._attributes?.year ? moment(new Date(+representativesSection?.SecondaryPositions?.Company?.ActivityStatus?.CancellationDate?._attributes?.year, (+representativesSection?.SecondaryPositions?.Company?.ActivityStatus?.CancellationDate?._attributes?.month - 1), +representativesSection?.SecondaryPositions?.Company?.ActivityStatus?.CancellationDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                })
            } else {
                activePositions.push({
                    position: representativesSection?.SecondaryPositions?.Company?.Positions?.Position?.Description?._text || '',
                    legalForm: representativesSection?.SecondaryPositions?.Company?.Form?._text || '',
                    taxCode: representativesSection?.SecondaryPositions?.Company?.TaxCode?._text || '',
                    companyName: representativesSection?.SecondaryPositions?.Company?.Name?._text || '',
                    site: `${representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                    rea: representativesSection?.SecondaryPositions?.Company?.REACode?._text || '',
                    province: representativesSection?.SecondaryPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                    status: representativesSection?.SecondaryPositions?.Company?.ActivityStatus?.Description?._text || '',
                })
            }
        }
    }
    //pregresse
    if (Array.isArray(representativesSection?.OnlyPastPositions?.Company)) {
        representativesSection?.OnlyPastPositions?.Company?.forEach((company: any) => {
            if (company?.Positions?.Position && Array.isArray(company?.Positions?.Position)) {
                company?.Positions?.Position?.forEach((position: any) => {
                    pastPositions.push({
                        position: position.Description?._text || '',
                        legalForm: company?.Form?._text || '',
                        taxCode: company?.TaxCode?._text || '',
                        companyName: company?.Name?._text || '',
                        site: `${company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                        rea: company?.REACode?._text || '',
                        province: company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                        status: company?.ActivityStatus?.Description?._text || '',
                        startDate: position?.StartDate?._attributes.year ? moment(new Date(+position?.StartDate?._attributes?.year, (+position?.StartDate?._attributes?.month - 1), +position?.StartDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                        cancellationDate: position?.CalculatedEndDate?._attributes?.year ? moment(new Date(+position?.CalculatedEndDate?._attributes?.year, (+position?.CalculatedEndDate?._attributes?.month - 1), +position?.CalculatedEndDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                    })
                })
            } else {
                pastPositions.push({
                    position: company?.Positions?.Position?.Description?._text || '',
                    legalForm: company?.Form?._text || '',
                    taxCode: company?.TaxCode?._text || '',
                    companyName: company?.Name?._text || '',
                    site: `${company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                    rea: company?.REACode?._text || '',
                    province: company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                    status: company?.ActivityStatus?.Description?._text || '',
                    startDate: company?.Positions?.Position?.StartDate?._attributes ? moment(new Date(+company?.Positions?.Position?.StartDate?._attributes?.year, (+company?.Positions?.Position?.StartDate?._attributes?.month - 1), +company?.Positions?.Position?.StartDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                    cancellationDate: company?.Positions?.Position?.CalculatedEndDate?._attributes?.year ? moment(new Date(+company?.Positions?.Position?.CalculatedEndDate?._attributes?.year, (+company?.Positions?.Position?.CalculatedEndDate?._attributes?.month - 1), +company?.Positions?.Position?.CalculatedEndDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                })
            }
        });
    } else {
        if (representativesSection?.OnlyPastPositions?.Company?.Positions?.Position && Array.isArray(representativesSection?.OnlyPastPositions?.Company?.Positions?.Position)) {
            representativesSection?.OnlyPastPositions?.Company?.Positions?.Position?.forEach((position: any) => {
                pastPositions.push({
                    position: position.Description?._text || '',
                    legalForm: representativesSection?.OnlyPastPositions?.Company?.Form?._text || '',
                    taxCode: representativesSection?.OnlyPastPositions?.Company?.TaxCode?._text || '',
                    companyName: representativesSection?.OnlyPastPositions?.Company?.Name?._text || '',
                    site: `${representativesSection?.OnlyPastPositions?.Company?.Addresses?.RegisteredHeadOffice?.Address?._text} ${representativesSection?.OnlyPastPositions?.Company?.Addresses?.RegisteredHeadOffice?.Municipality?._text} ` + (representativesSection?.OnlyPastPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${representativesSection?.OnlyPastPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                    rea: representativesSection?.OnlyPastPositions?.Company?.REACode?._text || '',
                    province: representativesSection?.OnlyPastPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                    status: representativesSection?.OnlyPastPositions?.Company?.ActivityStatus?.Description?._text || '',
                    startDate: position?.StartDate?._attributes ? moment(new Date(+position?.StartDate?._attributes?.year, (+position?.StartDate?._attributes?.month - 1), +position?.StartDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                    cancellationDate: position?.CalculatedEndDate?._attributes?.year ? moment(new Date(+representativesSection?.OnlyPastPositions?.Company?.Positions?.Position?.CalculatedEndDate?._attributes?.year, (+representativesSection?.OnlyPastPositions?.Company?.Positions?.Position?.CalculatedEndDate?._attributes?.month - 1), +representativesSection?.OnlyPastPositions?.Company?.Positions?.Position?.CalculatedEndDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                })
            })
        } else if (Object.keys(representativesSection?.OnlyPastPositions?.Company || {}).length) {
            pastPositions.push({
                position: representativesSection?.OnlyPastPositions?.Company?.Positions?.Position?.Description?._text || '',
                legalForm: representativesSection?.OnlyPastPositions?.Company?.Form?._text || '',
                taxCode: representativesSection?.OnlyPastPositions?.Company?.TaxCode?._text || '',
                companyName: representativesSection?.OnlyPastPositions?.Company?.Name?._text || '',
                site: `${representativesSection?.OnlyPastPositions?.Company?.Addresses?.RegisteredHeadOffice?.Address?._text || ''} ${representativesSection?.OnlyPastPositions?.Company?.Addresses?.RegisteredHeadOffice?.Municipality?._text || ''} ` + (representativesSection?.OnlyPastPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text ? `(${representativesSection?.OnlyPastPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text})` : ''),
                rea: representativesSection?.OnlyPastPositions?.Company?.REACode?._text || '',
                province: representativesSection?.OnlyPastPositions?.Company?.Addresses?.RegisteredHeadOffice?.ProvinceCode?._text || '',
                status: representativesSection?.OnlyPastPositions?.Company?.ActivityStatus?.Description?._text || '',
                startDate: representativesSection?.OnlyPastPositions?.Company?.Positions?.Position?.StartDate?._attributes ? moment(new Date(+representativesSection?.OnlyPastPositions?.Company?.Positions?.Position?.StartDate?._attributes?.year, (+representativesSection?.OnlyPastPositions?.Company?.Positions?.Position?.StartDate?._attributes?.month - 1), +representativesSection?.OnlyPastPositions?.Company?.Positions?.Position?.StartDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                cancellationDate: representativesSection?.OnlyPastPositions?.Company?.Positions?.Position?.CalculatedEndDate?._attributes?.year ? moment(new Date(+representativesSection?.OnlyPastPositions?.Company?.Positions?.Position?.CalculatedEndDate?._attributes?.year, (+representativesSection?.OnlyPastPositions?.Company?.Positions?.Position?.CalculatedEndDate?._attributes?.month - 1), +representativesSection?.OnlyPastPositions?.Company?.Positions?.Position?.CalculatedEndDate?._attributes?.day)).format("DD/MM/YYYY") : '',
            })
        }
    }
    return {
        activePositions,
        pastPositions
    }
}

export function companyShareholdingsPersonaGiuridica(holdings: any) {
    const companySheets: CompanyShareholding[] = []
    if (holdings && Array.isArray(holdings?.Holding)) {
        holdings?.Holding?.forEach((holding: any) => {
            companySheets.push({
                company: holding?.AziendaSlim?.CompanyInformation?.CompanyName?._text || '',
                taxCode: holding?.AziendaSlim?.CompanyInformation?.TaxCode?._text || '',
                legalForm: holding?.AziendaSlim?.CompanyInformation?.CompanyForm?._text || '',
                capitalValue: `${holding?.AziendaSlim?.EquityCapital?._text}€` || '',
                depositDate: moment(new Date(holding?.FilingDate?._attributes?.year, (holding?.FilingDate?._attributes?.month - 1), holding?.FilingDate?._attributes?.day)).format("DD/MM/YYYY") || '',
                protocolNumber: `${holding?.ProtocolDate?._attributes?.year}/${holding?.ProtocolNo?._text}` || '',
                site: `${holding?.AziendaSlim?.CompanyInformation?.Address?.Street?._text || ''} ${holding?.AziendaSlim?.CompanyInformation?.Address?.PostCode?._text || ''} ${holding?.AziendaSlim?.CompanyInformation?.Address?.Municipality?._text || ''} ${holding?.AziendaSlim?.CompanyInformation?.Address?.Province?._text || ''}`,
                activityStatus: holding?.AziendaSlim?.ActivityDescription?._text || '',
                typeOfactivity: holding?.AziendaSlim?.Ateco?._text || '',
                revenues: (holding?.AziendaSlim?.Revenue?.Value?._text === '0' ? 'N/C' : holding?.AziendaSlim?.Revenue?.Value?._text) || '',
                nominalValue: `${holding?.Shares?.Share?.NominalSharesValue?._text}€` || '',
                possessionPercentage: `${holding?.Shares?.Share?.SharesPercentage?._text}%` || '',
                straightDescription: holding?.Shares?.Share?.RightType?.Right?._text || '',
            })
        })
    } else if (holdings?.Holding) {
        companySheets.push({
            company: holdings?.Holding?.AziendaSlim?.CompanyInformation?.CompanyName?._text || '',
            taxCode: holdings?.Holding?.AziendaSlim?.CompanyInformation?.TaxCode?._text || '',
            legalForm: holdings?.Holding?.AziendaSlim?.CompanyInformation?.CompanyForm?._text || '',
            capitalValue: `${holdings?.Holding?.AziendaSlim?.EquityCapital?._text}€` || '',
            depositDate: moment(new Date(holdings?.Holding?.FilingDate?._attributes?.year, (holdings?.Holding?.FilingDate?._attributes?.month - 1), holdings?.Holding?.FilingDate?._attributes?.day)).format("DD/MM/YYYY") || '',
            protocolNumber: `${holdings?.Holding?.ProtocolDate?._attributes?.year}/${holdings?.Holding?.ProtocolNo?._text}` || '',
            site: `${holdings?.Holding?.AziendaSlim?.CompanyInformation?.Address?.Street?._text || ''} ${holdings?.Holding?.AziendaSlim?.CompanyInformation?.Address?.PostCode?._text || ''} ${holdings?.Holding?.AziendaSlim?.CompanyInformation?.Address?.Municipality?._text || ''} ${holdings?.Holding?.AziendaSlim?.CompanyInformation?.Address?.Province?._text || ''}`,
            activityStatus: holdings?.Holding?.AziendaSlim?.ActivityDescription?._text || '',
            typeOfactivity: holdings?.Holding?.AziendaSlim?.Ateco?._text || '',
            revenues: holdings?.Holding?.AziendaSlim?.Revenue?.Value?._text || '',
            nominalValue: `${holdings?.Holding?.Shares?.Share?.NominalSharesValue?._text}€` || '',
            possessionPercentage: `${holdings?.Holding?.Shares?.Share?.SharesPercentage?._text}%` || '',
            straightDescription: holdings?.Holding?.Shares?.Share?.RightType?.Right?._text || '',
        })
    } else if (holdings) {
        if (holdings?.Company?.TaxCode?._text) {
            companySheets.push({
                company: holdings?.Company?.Name?._text || '',
                taxCode: holdings?.Company?.TaxCode?._text || '',
                legalForm: holdings?.Company?.Form?._text || '',
                capitalValue: `${holdings?.Shares?.EquityCapital?._text}€` || '',
                depositDate: moment(new Date(holdings?.Deed?.FilingDate?._attributes?.year, (holdings?.Deed?.FilingDate?._attributes?.month - 1), holdings?.Deed?.FilingDate?._attributes?.day)).format("DD/MM/YYYY") || '',
                protocolNumber: '',
                site: `${holdings?.Company?.RegisteredHeadOffice?.Address?._text || ''} ${holdings?.Company?.RegisteredHeadOffice?.PostCode?._text || ''} ${holdings?.Company?.RegisteredHeadOffice?.Municipality?._text || ''} ${holdings?.Company?.RegisteredHeadOffice?.ProvinceCode?._text || ''}`,
                activityStatus: holdings?.Company?.ActivityStatus?.Description?._text || '',
                typeOfactivity: holdings?.Company?.Ateco2007?._text || '',
                revenues: (holdings?.Company?.BudgetData?.Revenues?._text === '0' ? 'N/C' : holdings?.Company?.BudgetData?.Revenues?._text) || '',
                nominalValue: `${holdings?.Shares?.List?.Share?.ShareValue?._text}€` || '',
                possessionPercentage: `${holdings?.Shares?.List?.Share?.ShareValue?._attributes?.Percentage}%` || '',
                straightDescription: holdings?.Shares?.List?.Share?.RightsType?._text || '',
            })
        }
    }
    return companySheets
}

export function convertPrejudicialPersonaFisica(negativity: any) {
    const result: any[] = [];
    let prejudicalConnectedCompanies: any[] | false = [];
    if (negativity?.Events?.ValidEvents?.ConnectedCompanies) {
        prejudicalConnectedCompanies = convertObjectToArray(negativity?.Events?.ValidEvents?.ConnectedCompanies?.ConnectedCompany)
    } else if (negativity?.Events?.ValidEvents?.Event) {
        prejudicalConnectedCompanies = convertObjectToArray(negativity?.Events?.ValidEvents?.Event)
    } else prejudicalConnectedCompanies = []
    prejudicalConnectedCompanies?.forEach(company => {
        const companyEvents = convertObjectToArray(company?.Events?.Event)
        companyEvents?.forEach((event: any, index: number) => {
            result.push({
                index,
                subjectVersus: event?.IdentificationData?.Name?._text ? event?.IdentificationData?.Name?._text : '',
                taxCode: event?.IdentificationData?.TaxCode?._text ? event?.IdentificationData?.TaxCode?._text : '',
                subjectBeneficiary: event?.Bill?.BeneficiaryName?._text ? event?.Bill?.BeneficiaryName?._text : '',
                conservatory: event?.IdentificationData?.Archive?._text ? event?.IdentificationData?.Archive?._text : '',
                actDate: event?.Bill?.RecordDate?._text ? `${event?.Bill?.RecordDate?._attributes?.day}/${event?.Bill?.RecordDate?._attributes?.month}/${event?.Bill?.RecordDate?._attributes?.year}` : '',
                genericNumber: event?.Bill?.GeneralNumber?._text ? event?.Bill?.GeneralNumber?._text : '',
                specificNumber: event?.Bill?.SpecificNumber?._text ? event?.Bill?.SpecificNumber?._text : '',
                actDescription: event?.Bill?.Record?._text ? event?.Bill?.Record?._text : '',
                actCode: event?.IdentificationData?.Archive?._attributes?.Code ? event?.IdentificationData?.Archive?._attributes?.Code : '',
                amount: event?.Bill?.CapitalAmount?._text ? event?.Bill?.CapitalAmount?._text : '',
                guarantedAmount: event?.Bill?.RecordedAmount?._text ? event?.Bill?.RecordedAmount?._text : ''
            })
        })
    });
    return result
}

export function convertDetailsPrejudicialPersonaFisica(elements: any) {
    let totalAmout: number = 0;
    let lastest: any;
    const events: any[] = [];
    //const prejudicalConnectedCompanies = convertObjectToArray(elements?.Events?.ValidEvents?.ConnectedCompanies?.ConnectedCompany)
    const companyEvents = convertObjectToArray(elements?.Events?.ValidEvents?.Event)
    if (companyEvents) {
        for (let index = 0; index < companyEvents.length; index++) {
            const event = companyEvents[index];
            events.push(event);

            const amountText = event?.Bill?.CapitalAmount?._text;
            if (amountText) {
                totalAmout += parseFloat(amountText.replace(".", "").replace(",", ".")).toFixed(3) as unknown as number;
            } else {
                totalAmout = 0;
            }

            const dateAttr = event?.Bill?.RecordDate?._attributes;
            const currentRegistrationDate = event?.Bill?.RecordDate?._text && dateAttr
                ? moment(new Date(dateAttr.year, dateAttr.month, dateAttr.day)).format("DD/MM/YYYY")
                : '';

            if (index === 0) {
                lastest = currentRegistrationDate;
            } else {
                lastest = moment(new Date(currentRegistrationDate)).isAfter(new Date(lastest))
                    ? currentRegistrationDate
                    : lastest;
            }
        }
            }
    /*
    prejudicalConnectedCompanies?.forEach(company => {
        const companyEvents = convertObjectToArray(company?.Events?.Event)
        companyEvents?.forEach((event: any, index: number) => {
            events.push(event)
            totalAmout = event?.Bill?.CapitalAmount?._text ? totalAmout + +parseFloat(event?.Bill?.CapitalAmount?._text.replace(".", "").replace(",", ".")).toFixed(3) : 0;
            const currentRegistrationDate = event?.Bill?.RecordDate?._text ? moment(new Date(
                event?.Bill?.RecordDate?._attributes?.year,
                event?.Bill?.RecordDate?._attributes?.month,
                event?.Bill?.RecordDate?._attributes?.day,
            )).format("DD/MM/YYYY") : '';
            if (index === 0) {
                lastest = currentRegistrationDate
            } else moment(new Date(currentRegistrationDate)).isAfter(new Date(lastest)) ? lastest = currentRegistrationDate : lastest = lastest
        })
    });
    */
    const pt1 = events.reduce((acc: any, curr: any) => {
        const key = curr?.Bill?.Record?._text;
        if (acc[key]) {
            acc[key].push(curr);
        } else {
            acc[key] = [curr];
        }
        return acc;
    }, {});
    const pt2 = Object.keys(pt1)?.map(descr => {
        return {
            descriptionPrejudical: descr,
            rows: pt1[descr]
        }
    })
    const pt3 = pt2?.map((element: any) => {
        const capitalValues = element.rows.map((row: any) => row?.Bill?.CapitalAmount?._text)
        var totalAmout = 0;
        try {
            totalAmout = capitalValues.reduce((a: string, b: string) => parseFloat(a.replace(".", "").replace(",", ".")) + parseFloat(b.replace(".", "").replace(",", ".")))
        } catch (error) {
            totalAmout = 0
        }
        const totalAmoutEvent = totalAmout;
        return {
            descriptionPrejudical: element.descriptionPrejudical,
            count: element.rows.length,
            totalAmoutEvent: capitalValues.length >= 1 ? totalAmoutEvent == 0 ? '0,00' : totalAmoutEvent : '0,00'
        }
    })
    return {
        count: pt3.length,
        totalAmout: new Intl.NumberFormat('it-IT', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(totalAmout).toString(),
        lastest,
        descriptions: pt3
    }
}

export function convertdescriptionProtestPersonaFisica(elements: any) {
    const result: descriptionProtest[] = [];
    let totalAmout = 0;
    let lastest: any;
    const protestConnectedEvents = convertObjectToArray(elements);
    let count = protestConnectedEvents.length || 0;
    protestConnectedEvents.forEach((nega: any, index: number) => {
        const currentRegistrationDate = nega?.Bill?.RegistrationDate?._attributes?.year ? moment(new Date(
            nega?.Bill?.RegistrationDate?._attributes?.year,
            nega?.Bill?.RegistrationDate?._attributes?.month,
            nega?.Bill?.RegistrationDate?._attributes?.day,
        )).format("DD/MM/YYYY") : '';
        const currentDeletionDate = nega?.Bill?.DeletionDate?._attributes?.year ? moment(new Date(
            nega?.Bill?.DeletionDate?._attributes?.year,
            nega?.Bill?.DeletionDate?._attributes?.month,
            nega?.Bill?.DeletionDate?._attributes?.day,
        )).format("DD/MM/YYYY") : '';
        result.push({
            title: nega?.IdentificationData?.Name?._text ? nega?.IdentificationData?.Name?._text : '',
            taxCode: nega?.IdentificationData?.TaxCode?._text ? nega?.IdentificationData?.TaxCode?._text : '',
            address: nega?.IdentificationData?.Residence?.Address?._text || '',
            levata: nega.Bill?.DeletionDate?._attributes?.year ? currentDeletionDate : '',
            registrationData: nega?.Bill?.RegistrationDate?._attributes?.year ? currentRegistrationDate : '',
            typeOfEffect: nega?.Bill?.Type?._text || '',
            amount: nega?.Bill?.Amount?._text?.length ? new Intl.NumberFormat('de-DE', socialCapitalOptions).format(parseFloat(nega?.Bill?.Amount?._text.replace(".", "").replace(",", "."))).toString() : '',
            causal: nega?.Bill?.DeclinedPaymentReason?._text || ''
        })
        totalAmout = nega?.Bill?.Amount?._text ? totalAmout + parseFloat(nega?.Bill?.Amount?._text.replace(".", "").replace(",", ".")) : totalAmout;
        if (index === 0) {
            lastest = currentRegistrationDate
        } else moment(new Date(currentRegistrationDate)).isAfter(new Date(lastest)) ? lastest = currentRegistrationDate : lastest = lastest
    })

    return {
        count,
        totalAmout: new Intl.NumberFormat('de-DE', socialCapitalOptions).format(totalAmout).toString(),
        lastest,
        values: result
    }
}

export function convertObjectToArray(element: any) {
    if (element) {
        if (Array.isArray(element)) return element
        return [element]
    } else return []
}

export function convertdescriptionPrejudicial(elements: any) {
    const result: descriptionPrejudicial[] = [];
    elements?.forEach((negativity: any) => {
        const negativityList = convertObjectToArray(negativity)
        negativityList.forEach((nega: any) => {
            const currentActDate = nega?.FormalityEvent?.EventDate?._attributes?.year ?
                nega?.FormalityEvent?.EventDate?._attributes?.day + "/" + nega?.FormalityEvent?.EventDate?._attributes?.month + "/" + nega?.FormalityEvent?.EventDate?._attributes?.year : '';
            result.push({
                title: nega?.FormalityEvent?.EventDescription?._text || '',
                conservatory: nega?.DepartmentInformation?.DepartmentDescription?._text || '',
                actDate: currentActDate,
                generalNumberDetail: nega?.NumberRegistrationInfo?.RegistrationNumber._text || '',
                actCode: nega?.MinisterialCode?._text || '',
                amount: nega?.AmountEnrolledInEuros?._text?.length ? new Intl.NumberFormat('de-DE', socialCapitalOptions).format(nega?.AmountEnrolledInEuros?._text).toString() : '',
                guaranteedAmount: nega?.CapitalAmountInEuros?._text?.length ? new Intl.NumberFormat('de-DE', socialCapitalOptions).format(nega?.CapitalAmountInEuros?._text).toString() : '',
                subjectAgainst: {
                    name: nega?.IdentificationDetailsAgainst?.Person?.Name?._text || '',
                    taxCode: nega?.IdentificationDetailsAgainst?.Person?.TaxCode?._text || ''
                },
                subjectFavour: nega?.Beneficiary?.Company?.CompanyName?._text || ''
            })
        })
    })
    return result
}

export function convertdescriptionProtest(protestBlock: any) {
    const negativities = convertObjectToArray(protestBlock);
    const result: descriptionProtest[] = [];
    let totalAmout = 0;
    let sum = 0
    const numberProtest = convertObjectToArray(protestBlock?.InfluentialProtestsNumber)
    numberProtest.forEach(element => {
        sum = sum + parseInt(element?._text || "0")
    });
    let count = sum.toString() || negativities.length;
    let lastest: any;
    negativities.forEach((nega: any, index: number) => {
        const singleProtestBlocks = convertObjectToArray(nega?.SingleProtestBlock);
        singleProtestBlocks.forEach(singleProtestBlock => {
            const currentRegistrationDate = singleProtestBlock?.RegistryRegistrationDate?._attributes?.year ?
                singleProtestBlock.RegistryRegistrationDate._attributes?.year + "/" + singleProtestBlock.RegistryRegistrationDate._attributes?.month + "/" + singleProtestBlock.RegistryRegistrationDate._attributes?.day : '';
            result.push({
                title: nega?.Company?.CompanyName?._text ? nega?.Company?.CompanyName?._text : nega?.Subject?.Name?._text ? nega?.Subject?.Name?._text : '',
                taxCode: nega?.Company?.TaxCode?._text ? nega?.Company?.TaxCode?._text : nega?.Subject?.TaxCode?._text ? nega?.Subject?.TaxCode?._text : '',
                address: singleProtestBlock?.ProtestCompany?.Address?.Municipality?._text ? `${singleProtestBlock?.ProtestCompany?.Address?.Municipality?._text} (${singleProtestBlock?.ProtestCompany?.Address?.Province?._text})` : singleProtestBlock?.ProtestSubject?.ResidenceAddress?.Municipality?._text ? `${singleProtestBlock?.ProtestSubject?.ResidenceAddress?.Municipality?._text} (${singleProtestBlock?.ProtestSubject?.ResidenceAddress?.Province?._text})` : '',
                levata: nega.SingleProtestBlock?.StringDeletionDate?._text ? moment(new Date(nega.SingleProtestBlock?.StringDeletionDate?._text)).format("DD/MM/YYYY") : '',
                registrationData: singleProtestBlock?.RegistryRegistrationDate?._attributes?.year ? currentRegistrationDate : '',
                typeOfEffect: singleProtestBlock?.BillTypeDescription?._text || '',
                amount: nega?.ProtestsAmount?._text?.length ? new Intl.NumberFormat('de-DE', socialCapitalOptions).format(nega?.ProtestsAmount?._text).toString() : '',
                causal: singleProtestBlock?.RefusalReasonDescription?._text || ''
            })
            if (index === 0) {
                lastest = currentRegistrationDate
            } else moment(new Date(currentRegistrationDate)).isAfter(new Date(lastest)) ? lastest = currentRegistrationDate : lastest = lastest
        });
        totalAmout = nega?.ProtestsAmount?._text ? totalAmout + +nega?.ProtestsAmount?._text : totalAmout;
    })
    return {
        count,
        totalAmout: new Intl.NumberFormat('de-DE', socialCapitalOptions).format(totalAmout).toString(),
        lastest: lastest,
        values: result
    }
}

export function convertdescriptionInsolvencyProceedings(elements: any) {
    const negativities = convertObjectToArray(elements);
    const result: descriptionInsolvencyProceeding[] = [];
    negativities.forEach((nega: any) => {
        result.push({
            title: nega?.AgainstItemInformation?.AgainstItemCompany?.CompanyName?._text || '',
            taxCode: nega?.AgainstItemInformation?.AgainstItemCompany?.TaxCode?._text || '',
            address: '',
            act: nega?.EventDescription?._text || '',
            startDate: nega?.OpeningDate?._attributes?.year ? `${nega?.OpeningDate?._attributes?.day}/${nega?.OpeningDate?._attributes?.month}/${nega?.OpeningDate?._attributes?.year}` : '',
            registrationDate: nega?.RIIscriptionDate?._attributes?.year ? `${nega?.RIIscriptionDate?._attributes?.day}/${nega?.RIIscriptionDate?._attributes?.month}/${nega?.RIIscriptionDate?._attributes?.year}` : ''
        })
    })
    return result
}

export async function valueFromResponsePurchase(productPurchaseResponse: { [key: string]: any }) {
    try {
        if (productPurchaseResponse?.ReportImprenditore) {
            return {
                ProtestsAndPrejudicialEvents: productPurchaseResponse?.ReportImprenditore?.Dossier?.ProtestsAndPrejudicialEvents,
                Shareholdings: productPurchaseResponse?.ReportImprenditore?.Dossier?.Shareholdings,
                PositionsInCompanies: productPurchaseResponse?.ReportImprenditore?.Dossier?.PositionsInCompanies
            }
        } else if (productPurchaseResponse?.CheckImprenditore) {
            return {
                ProtestsAndPrejudicialEvents: productPurchaseResponse?.CheckImprenditore?.Dossier?.ProtestsAndPrejudicialEvents,
                Shareholdings: productPurchaseResponse?.CheckImprenditore?.Dossier?.Shareholdings,
                PositionsInCompanies: productPurchaseResponse?.CheckImprenditore?.Dossier?.PositionsInCompanies
            }
        } else if (productPurchaseResponse?.CheckPersonaFisica) {
            return {
                ProtestsAndPrejudicialEvents: productPurchaseResponse?.CheckPersonaFisica?.Dossier?.ProtestsAndPrejudicialEvents,
                Shareholdings: productPurchaseResponse?.CheckPersonaFisica?.Dossier?.Shareholdings,
                PositionsInCompanies: productPurchaseResponse?.CheckPersonaFisica?.Dossier?.PositionsInCompanies
            }
        } else return {}

    } catch (error) {
        console.error(error);
        await executionJob.error((error as CustomError).message);
        return false

    }
}

export function convertPrejudicialPersonaFisicaDittaIndividuale(negativity: any) {
    const result: any[] = [];
    const prejudicalConnectedCompanies = convertObjectToArray(negativity?.Events?.ValidEvents?.Event)
    prejudicalConnectedCompanies?.forEach((event: any, index: number) => {
        result.push({
            index,
            subjectVersus: event?.IdentificationData?.Name?._text ? event?.IdentificationData?.Name?._text : '',
            taxCode: event?.IdentificationData?.TaxCode?._text ? event?.IdentificationData?.TaxCode?._text : '',
            subjectBeneficiary: event?.Bill?.BeneficiaryName?._text ? event?.Bill?.BeneficiaryName?._text : '',
            conservatory: event?.IdentificationData?.Archive?._text ? event?.IdentificationData?.Archive?._text : '',
            actDate: event?.Bill?.RecordDate?._text ? `${event?.Bill?.RecordDate?._attributes?.day}/${event?.Bill?.RecordDate?._attributes?.month}/${event?.Bill?.RecordDate?._attributes?.year}` : '',
            genericNumber: event?.Bill?.GeneralNumber?._text ? event?.Bill?.GeneralNumber?._text : '',
            specificNumber: event?.Bill?.SpecificNumber?._text ? event?.Bill?.SpecificNumber?._text : '',
            actDescription: event?.Bill?.Record?._text ? event?.Bill?.Record?._text : '',
            actCode: event?.IdentificationData?.Archive?._attributes?.Code ? event?.IdentificationData?.Archive?._attributes?.Code : '',
            amount: event?.Bill?.CapitalAmount?._text ? event?.Bill?.CapitalAmount?._text : '',
            guarantedAmount: event?.Bill?.RecordedAmount?._text ? event?.Bill?.RecordedAmount?._text : ''
        })
    });
    return result
}

export function convertDetailsPrejudicialPersonaFisicaDittaIndividuale(elements: any) {
    let totalAmout: number = 0;
    let lastest: any;
    const events: any[] = [];
    const prejudicalConnectedCompanies = convertObjectToArray(elements?.Events?.ValidEvents?.Event)
    prejudicalConnectedCompanies?.forEach((event: any, index: number) => {
        events.push(event)
        totalAmout = event?.Bill?.CapitalAmount?._text ? totalAmout + +parseFloat(event?.Bill?.CapitalAmount?._text.replace(".", "").replace(",", ".")).toFixed(3) : 0;
        const currentRegistrationDate = event?.Bill?.RecordDate?._text ? moment(new Date(
            event?.Bill?.RecordDate?._attributes?.year,
            event?.Bill?.RecordDate?._attributes?.month,
            event?.Bill?.RecordDate?._attributes?.day,
        )).format("DD/MM/YYYY") : '';
        if (index === 0) {
            lastest = currentRegistrationDate
        } else moment(new Date(currentRegistrationDate)).isAfter(new Date(lastest)) ? lastest = currentRegistrationDate : lastest = lastest
    });
    const pt1 = events.reduce((acc: any, curr: any) => {
        const key = curr?.Bill?.Record?._text;
        if (acc[key]) {
            acc[key].push(curr);
        } else {
            acc[key] = [curr];
        }
        return acc;
    }, {});
    const pt2 = Object.keys(pt1)?.map(descr => {
        return {
            descriptionPrejudical: descr,
            rows: pt1[descr]
        }
    })

    const pt3 = pt2?.map((element: any) => {
        const capitalValues = element.rows.map((row: any) => row?.Bill?.CapitalAmount?._text);
        // var totalAmoutEvent = 0;
        //if (capitalValues && capitalValues.length !== 0) {            
        //   totalAmoutEvent = capitalValues.reduce((a: string, b: string) => parseFloat(a.replace(".", "").replace(",", ".")) + parseFloat(b.replace(".", "").replace(",", ".")))
            // Utility di parsing (dichiara SEMPRE il tipo di ritorno!)
            const parseEuro = (v: string): number =>
            Number(v.replace(/\./g, '').replace(',', '.'));
            const totalAmountEvent = capitalValues          // string[]
                .map(parseEuro)                               // number[]
                .reduce((sum: number, n: number) => sum + n, 0);
        //}
        return {
            descriptionPrejudical: element.descriptionPrejudical,
            count: element.rows.length,
            totalAmoutEvent: capitalValues.length >= 1 ? totalAmountEvent == 0 ? '0,00' : totalAmountEvent : '0,00'
        }
    })

    return {
        count: pt3.length,
        totalAmout: totalAmout == 0 ? '0,00' : totalAmout,
        lastest,
        descriptions: pt3
    }
}

export function getRecoverabilityJudgment(element: any, type: string) {
    switch (type) {
        case 'PersonaGiuridica':
            //caso 1
            if (
                element.isOperativity &&
                element.buildings?.find &&
                (element.vehicles?.vehiclesSocieta?.length || element.vehicles?.vehiclesPersona?.length) &&
                element.bankingRelationships?.length &&
                !element.negativity?.insolvencyProceedings?.value &&
                !element.negativity?.prejudicial?.value &&
                !element.negativity?.protests?.flag
            ) return true
            //caso 2
            if (
                element.isOperativity &&
                element.buildings?.find &&
                (element.vehicles?.vehiclesSocieta?.length || element.vehicles?.vehiclesPersona?.length) &&
                !element.bankingRelationships?.length &&
                !element.negativity?.insolvencyProceedings?.value &&
                !element.negativity?.prejudicial?.value &&
                !element.negativity?.protests?.flag
            ) return true
            //caso 3
            if (
                element.isOperativity &&
                element.buildings?.find &&
                !(element.vehicles?.vehiclesSocieta?.length || element.vehicles?.vehiclesPersona?.length) &&
                element.bankingRelationships?.length &&
                !element.negativity?.insolvencyProceedings?.value &&
                !element.negativity?.prejudicial?.value &&
                !element.negativity?.protests?.flag
            ) return true
            //caso 4
            if (
                element.isOperativity &&
                !element.buildings?.find &&
                (element.vehicles?.vehiclesSocieta?.length || element.vehicles?.vehiclesPersona?.length) &&
                element.bankingRelationships?.length &&
                !element.negativity?.insolvencyProceedings?.value &&
                !element.negativity?.prejudicial?.value &&
                !element.negativity?.protests?.flag
            ) return true
            //Negativo
            //caso 1
            if (
                element.negativity?.insolvencyProceedings?.value ||
                element.negativity?.prejudicial?.value ||
                element.negativity?.protests?.flag
            ) return false
            //caso 2
            if (
                element.isOperativity &&
                !element.buildings?.find &&
                !(element.vehicles?.vehiclesSocieta?.length || element.vehicles?.vehiclesPersona?.length) &&
                !element.bankingRelationships?.length &&
                !element.negativity?.insolvencyProceedings?.value &&
                !element.negativity?.prejudicial?.value &&
                !element.negativity?.protests?.flag
            ) return false
            //caso 3
            if (
                !element.isOperativity
            ) return false
            break;
        case 'PersonaFisica':
            //Positivo
            //caso 1
            if (
                element.isReperibilita &&
                !!element.workingActivity?.activityJob?.find((x: any) => x?.jobTitle !== 'Disoccupato') &&
                element.buildings?.find &&
                element.vehicles?.length &&
                element.bankingRelationships?.length &&
                !element.negativity?.insolvencyProceedings &&
                !element.negativity?.prejudicial?.value &&
                !element.negativity?.protests?.flag
            ) return true
            //caso 2
            if (
                element.isReperibilita &&
                !!element.workingActivity?.activityJob?.find((x: any) => x?.jobTitle !== 'Disoccupato') &&
                element.buildings?.find &&
                element.vehicles?.length &&
                !element.bankingRelationships?.length &&
                !element.negativity?.insolvencyProceedings &&
                !element.negativity?.prejudicial?.value &&
                !element.negativity?.protests?.flag
            ) return true
            //caso 3
            if (
                element.isReperibilita &&
                !!element.workingActivity?.activityJob?.find((x: any) => x?.jobTitle !== 'Disoccupato') &&
                element.buildings?.find &&
                !element.vehicles?.length &&
                element.bankingRelationships?.length &&
                !element.negativity?.insolvencyProceedings &&
                !element.negativity?.prejudicial?.value &&
                !element.negativity?.protests?.flag
            ) return true
            //caso 4
            if (
                element.isReperibilita &&
                !!element.workingActivity?.activityJob?.find((x: any) => x?.jobTitle !== 'Disoccupato') &&
                !element.buildings?.find &&
                element.vehicles?.length &&
                element.bankingRelationships?.length &&
                !element.negativity?.insolvencyProceedings &&
                !element.negativity?.prejudicial?.value &&
                !element.negativity?.protests?.flag
            ) return true
            //caso 5
            if (
                element.isReperibilita &&
                !!element.workingActivity?.activityJob?.find((x: any) => x?.jobTitle !== 'Disoccupato') &&
                !element.buildings?.find &&
                !element.vehicles?.length &&
                element.bankingRelationships?.length &&
                !element.negativity?.insolvencyProceedings &&
                !element.negativity?.prejudicial?.value &&
                !element.negativity?.protests?.flag
            ) return true
            //caso 6
            if (
                element.isReperibilita &&
                !!element.workingActivity?.activityJob?.find((x: any) => x?.jobTitle === 'Disoccupato') &&
                element.buildings?.find &&
                element.vehicles?.length &&
                element.bankingRelationships?.length &&
                !element.negativity?.insolvencyProceedings &&
                !element.negativity?.prejudicial?.value &&
                !element.negativity?.protests?.flag
            ) return true
            //caso 7
            if (
                element.isReperibilita &&
                !!element.workingActivity?.activityJob?.find((x: any) => x?.jobTitle === 'Disoccupato') &&
                !element.buildings?.find &&
                element.vehicles?.length &&
                element.bankingRelationships?.length &&
                !element.negativity?.insolvencyProceedings &&
                !element.negativity?.prejudicial?.value &&
                !element.negativity?.protests?.flag
            ) return true
            //caso 8
            if (
                element.isReperibilita &&
                !!element.workingActivity?.activityJob?.find((x: any) => x?.jobTitle === 'Disoccupato') &&
                element.buildings?.find &&
                !element.vehicles?.length &&
                element.bankingRelationships?.length &&
                !element.negativity?.insolvencyProceedings &&
                !element.negativity?.prejudicial?.value &&
                !element.negativity?.protests?.flag
            ) return true
            //caso 9
            if (
                element.isReperibilita &&
                !!element.workingActivity?.activityJob?.find((x: any) => x?.jobTitle === 'Disoccupato') &&
                element.buildings?.find &&
                element.vehicles?.length &&
                !element.bankingRelationships?.length &&
                !element.negativity?.insolvencyProceedings &&
                !element.negativity?.prejudicial?.value &&
                !element.negativity?.protests?.flag
            ) return true
            //Negativo
            //caso 1
            if (
                element.negativity?.insolvencyProceedings ||
                element.negativity?.prejudicial?.value ||
                element.negativity?.protests?.flag
            ) return false
            //caso 2
            if (
                element.isReperibilita &&
                !!element.workingActivity?.activityJob?.find((x: any) => x?.jobTitle !== 'Disoccupato') &&
                !element.buildings?.find &&
                !element.vehicles?.length &&
                !element.bankingRelationships?.length &&
                !element.negativity?.insolvencyProceedings &&
                !element.negativity?.prejudicial?.value &&
                !element.negativity?.protests?.flag
            ) return false
            //caso 3
            if (
                element.isReperibilita &&
                !!element.workingActivity?.activityJob?.find((x: any) => x?.jobTitle === 'Disoccupato') &&
                !element.buildings?.find &&
                !element.vehicles?.length &&
                !element.bankingRelationships?.length &&
                !element.negativity?.insolvencyProceedings &&
                !element.negativity?.prejudicial?.value &&
                !element.negativity?.protests?.flag
            ) return false
            //caso 4
            if (
                !element.isReperibilita
            ) return false
            break;
    }
    return false
}

/**
 * Questa funzione rimuove locamente il pdf
 */
export const removeLocalPDF = async (dir: string, nameFile: string, transaction: Transaction) => {
    try {
        await fs.unlink(dir + nameFile);
        console.log('Rimozione file locale effettuata: ', dir + nameFile)
        if (nameFile.includes('.pdf')) {
            await fs.unlink(dir + '1-' + nameFile);
            console.log('Rimozione file locale effettuata: ', dir + '1-' + nameFile)
        }

    }
    catch (error) {
        console.log('Errore durante la rimozione locale del file: ', dir)
        console.error(error);
        await transaction.rollback()
        await executionJob.error((error as CustomError).message);
        return false
    }
}

// questa funzione serve a predere solamente gli eredi chiamati
export async function getSearchHeirs(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultErediChiamati, metadataErediChiamati] = await pgConnection.query(generateQueryErediChiamati(investigation_record_id));
        return convertErediChiamati(resultErediChiamati)
    } catch (error) {
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

// questa funzione serve a predere solamente gli eredi accettanti
export async function getAcceptingHeirs(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultErediiAccettanti, metadataErediiAccettanti] = await pgConnection.query(generateQueryErediAccettanti(investigation_record_id));
        return convertErediAccettanti(resultErediiAccettanti)
    } catch (error) {
        await executionJob.error((error as CustomError).message);
        return false;
    }
}


export async function getAnagraDecesso(investigation_record_id: string, pgConnection: Sequelize) {
    try {
        const [resultQuery, metadataQuery] = await pgConnection.query(generateQueryPersonaFisica(investigation_record_id));
        return convertAnagraficaDecesso(resultQuery)
    } catch (error) {
        await executionJob.error((error as CustomError).message);
        return false;
    }
}

export function convertAnagraficaDecesso(resultsQuery: any[]) {
    //Converter Response Query eredi
    let anagrafica = {
        surname: resultsQuery.length ? resultsQuery[0].cognome || '' : '',
        name: resultsQuery.length ? resultsQuery[0].nome || '' : '',
        cf: resultsQuery.length ? resultsQuery[0].codice_fiscale || '' : '',
        dateOfBirth: resultsQuery.length ? moment(new Date(resultsQuery[0].data_nascita)).format('DD/MM/YYYY') : '',
        placeOfBirth: resultsQuery.length ? resultsQuery[0].persona_fisica__comune_nascita || '' : '',
        address: resultsQuery.length ? `${resultsQuery[0].decesso__indirizzo_toponimo || ''} ${resultsQuery[0].decesso__indirizzo_via || ''} ${resultsQuery[0].decesso__indirizzo_civico || ''} - ${resultsQuery[0].decesso__indirizzo_cap || ''} ${resultsQuery[0].decesso__indirizzo_comune || ''} ${resultsQuery[0].decesso__indirizzo_provincia?.length ? `(${resultsQuery[0].decesso__indirizzo_provincia})` : ''}` : '',
        dateOfDeath: resultsQuery.length && resultsQuery[0].decesso__date  ? moment(new Date(resultsQuery[0].decesso__date)).format('DD/MM/YYYY') : '',
        deathNote: resultsQuery.length ? resultsQuery[0].decesso__note || '' : '',
    } as any
    try {
        const codiceFiscale = new CodiceFiscale(anagrafica.cf);
        anagrafica.dateOfBirth = anagrafica.dateOfBirth != '' ? anagrafica.dateOfBirth : moment(codiceFiscale.birthday).format('DD/MM/YYYY'),
            anagrafica.placeOfBirth = anagrafica.placeOfBirth != '' ? anagrafica.placeOfBirth : codiceFiscale.birthplace.nome,
            anagrafica.provinceOfBirth = anagrafica.provinceOfBirth != '' ? anagrafica.provinceOfBirth : codiceFiscale.birthplace.prov
    }
    catch (error) {
        console.error("Codice fiscale non corretto", anagrafica.cf)
    }
    return anagrafica
}

export function generateIdAttachments(idOfAttachments: string) {

    while (idOfAttachments.length != 9) {
        idOfAttachments = '0' + idOfAttachments
    }
    let arrayPartsOfIdAttchament: string[] = []
    for (let i = 3; i <= 9; i += 3) {
        arrayPartsOfIdAttchament.push(idOfAttachments.substring(i - 3, i));

    }
    return arrayPartsOfIdAttchament;
}