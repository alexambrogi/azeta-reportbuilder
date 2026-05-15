import { Sequelize } from 'sequelize';
import Client from 'ssh2-sftp-client';
import xlsx from 'xlsx-js-style';
import { ExecutionJob } from '../models/logger.model';
import { CustomError, PATHFILE } from '../utils';
import { convertJsonIntoData } from '../converter/persona-massiva.converter';
import { closeEntrusted } from './db-ciro-entrusted.service';
import { sendFileWithSFTP } from './sftp-external.service';
import { generateQueryVerifyClosedEntrust } from '../database/postgres/query/postgres.query';

export async function generateMassiveExport(requests: any[], sftp: Client, id_entrust: string, pgConnection: Sequelize) {
    const [resultEntrust,metadataEntrust] = await pgConnection.query(generateQueryVerifyClosedEntrust(id_entrust));
    if(resultEntrust.length){
        console.log("ci sono pratiche non chiuse : ",resultEntrust)
        return
    }
    const executionJob = new ExecutionJob();
    try {
        const searchLight = ['713', '714', '714_NR','768','769','769_NR'];
        const mapForCampaign = await convertForExcel(searchLight, id_entrust, requests, pgConnection);
        if (mapForCampaign === false) {
            return
        }

        const firstRequest = requests.filter(request => searchLight.includes(request.campaign_kind_id) && id_entrust.includes(request.id_entrust))[0]
        const author_id = firstRequest.author_id
        const entrust_code = firstRequest.entrust_code
        const id_request = firstRequest.id_request
        const workbook = xlsx.utils.book_new();
        let exportFileName =''
        mapForCampaign.forEach((bodyForCampaign, campaign_kind_id) => {
            if (bodyForCampaign.length) {
                exportFileName = takeNameForCampaignKindId(campaign_kind_id,id_entrust);
                let typeService = takeTypeForCampaignKindId(campaign_kind_id);
                let workSheet;

                workSheet = generateHeader(Object.keys(bodyForCampaign[0]), typeService);
                xlsx.utils.sheet_add_json(workSheet, bodyForCampaign, { origin: 2, skipHeader: true })
                xlsx.utils.book_append_sheet(workbook, workSheet, typeService)
            }
        })
        xlsx.writeFile(workbook, `./src/pdf/${exportFileName}`);

        const transaction = await pgConnection.transaction();
        const res = await sendFileWithSFTP(exportFileName,PATHFILE,author_id,id_request,transaction,pgConnection,sftp);
        console.log("ho depositato il massivo su ",id_request)
        if(res === false) return
        await closeEntrusted(pgConnection,transaction,new ExecutionJob(),id_entrust,entrust_code)
        transaction.commit()
    } catch (error) {
        console.log('---- ERROR: ', error)
        await executionJob.error((error as CustomError).message);
    }

}

async function convertForExcel(arrayCampaign: string[], id_entrust: string, request: any[], pgConnection: Sequelize) {
    const mapForCampaign = new Map<string, any>();
    arrayCampaign.forEach(campaign => {
        mapForCampaign.set(campaign, [])
    });
    for (const raw of request) {
        console.log(raw)
        if (raw.id_entrust.includes(id_entrust) && arrayCampaign.includes(raw.campaign_kind_id)) {
            let list;
            console.log('[raw.campaign_kind_id]', raw.campaign_kind_id.toString())
            const [isNoRea, json] = await convertJsonIntoData(raw, mapForCampaign, pgConnection);
            if (json === false) {
                console.log("errore durante la compilazione del massivo")
                return false;
            }
            if (isNoRea) {
                console.log('sono un no rea')
                list = mapForCampaign.get(raw.campaign_kind_id + '_NR');
                list.push(json);
                mapForCampaign.set((raw.campaign_kind_id as string) + '_NR', list);
            } else {
                list = mapForCampaign.get(raw.campaign_kind_id);
                list.push(json);
                mapForCampaign.set(raw.campaign_kind_id as string, list);
            }

        }
    }
    return mapForCampaign;

}


function generateHeader(headers: string[], typeOfService: string) {
    let header: any = [];
    let merged: any = []
    let partialHeader: any = [];
    let verbalIndexEnd;
    if (typeOfService.includes('Persona Fisica'))
        verbalIndexEnd = 'BF'
    else if (typeOfService.includes('Persona Giuridica'))
        verbalIndexEnd = 'CF'
    else
        verbalIndexEnd = 'BE'
    //prima riga
    partialHeader = generatePartialHeader('A', 'O', partialHeader, 'DATI INPUT', 'F08700', 20);
    if (typeOfService.includes('Persona Giuridica')) {
        console.log('sono nel genera header persona giuridica')
        partialHeader = generatePartialHeader('P', 'AR', partialHeader, 'ESITO INDAGINI', '80D8FF', 20);
        partialHeader = generatePartialHeader('AS', verbalIndexEnd, partialHeader, 'ESITO INDAGINI LEGALE RAPPRESENTANTE', '123B65', 20);
    } else if (typeOfService.includes('Persona Fisica')) {
        partialHeader = generatePartialHeader('P', verbalIndexEnd, partialHeader, 'ESITO INDAGINI', '123B65', 20);
    } else {
        console.log('sono nel genera header noRea')
        partialHeader = generatePartialHeader('P', verbalIndexEnd, partialHeader, 'ESITO INDAGINI', '80D8FF', 20);
    }
    header.push(partialHeader)
    partialHeader = [];
    //seconda riga opzionale
    //seconda riga o terza riga
    partialHeader = generatePartialHeader('A', 'O', partialHeader, headers, 'F08700', 10)
    partialHeader = generatePartialHeader('P', verbalIndexEnd, partialHeader, headers, '7EA4CD', 10)
    header.push(partialHeader)
    let ws = xlsx.utils.aoa_to_sheet(header);
    merged.push(mergeColumn('A', 'O', 0))
    if (typeOfService.includes('Persona Giuridica')) {
        merged.push(mergeColumn('P', 'AR', 0))
        merged.push(mergeColumn('AS', verbalIndexEnd, 0))
    } else {
        merged.push(mergeColumn('P', verbalIndexEnd, 0))
    }
    ws['!merges'] = merged;
    return ws;
}

function generatePartialHeader(startCol: string, endCol: string, header: any[], name: string | string[], color: string, size: number) {
    // Definisci l'intervallo di colonne (da A a BZ)

    const startColIndex = xlsx.utils.decode_col(startCol);
    // Calcola l'indice numerico della colonna finale
    const endColIndex = xlsx.utils.decode_col(endCol);
    // Ciclo per creare le intestazioni
    const border = {
        top: { style: 'thin', color: '000000' },
        bottom: { style: 'thin', color: '000000' },
        left: { style: 'thin', color: '000000' },
        right: { style: 'thin', color: '000000' }
    }
    for (let i = startColIndex; i <= endColIndex; i++) {
        let raw;
        if (Array.isArray(name)) {
            raw = { v: name[i], t: "s", s: { fill: { fgColor: { rgb: color } }, font: { bold: true, name: "Calibri", sz: size, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: border } }

        } else {
            raw = { v: name, t: "s", s: { fill: { fgColor: { rgb: color } }, font: { name: "Calibri", sz: size, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: border } }
        }
        header.push(raw)
    }
    return header;
}


function mergeColumn(startCol: string, endCol: string, riga: number) {
    const startColIndex = xlsx.utils.decode_col(startCol);
    // Calcola l'indice numerico della colonna finale
    const endColIndex = xlsx.utils.decode_col(endCol);

    const jsonMerge = { s: { c: startColIndex, r: riga }, e: { c: endColIndex, r: riga } }
    return jsonMerge;
}
function takeNameForCampaignKindId(campaign_kind_id : string,id_entrust:string): string {
    if(['713', '714', '714_NR'].includes(campaign_kind_id))
        return `SEARCH_LIGHT_MASSIVO_${id_entrust}.xlsx`
    else
        return `SEARCH_CRIBIS_MEDIUM_MASSIVO_${id_entrust}.xlsx`
}

function takeTypeForCampaignKindId(campaign_kind_id : string): string {
    if (['713','768'].includes(campaign_kind_id)) {
        return 'Persona Fisica'
    } else if (['714','769'].includes(campaign_kind_id)) {
        console.log('sono nel giuridica', campaign_kind_id)
        return 'Persona Giuridica'
    } else {
        return 'No Rea'
    }
}


