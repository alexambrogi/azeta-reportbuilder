import { json, Sequelize } from "sequelize";
import { InsertAttachments } from "../../../models/ciro.model"

/**
 * Oggetto che contiene tutte le query da fare su postgres
 * codice servizio = 698
 * codice cliente = 20
 * stato richiesta = completed
 */
export const PostgresQuery = {
    getRequestsQuery: `
    Select ck.*, er.*, ea.*, i.*, er.id as id_request, e.id as id_entrust, er.created_at as date_create_entrust,er2.author_id ,e.entrust_code,er2.codici_fiscali as codicifiscaliandcustomcode,ck.name as ck_name
    from entrust_requests as er
    	inner join campaign_kinds ck on er.campaign_kind_id = ck.id 
    	inner join entrusts as e on er.id = e.entrust_request_id 
    	inner join entrust_assignments as ea on e.id = ea.entrust_id 
        inner join entrust_requests er2 on er2.id = e.entrust_request_id  
    	inner join investigated_subjects as i on ea.investigated_subject_id = i.id 
    where
        (er.campaign_kind_id in (683,684,787,693,694,695,696,698,699,700,701,702,789,790,703,704,875,396,705,706,707,708,709,711,712,786,713,784,714,785,715,716,811,768,769,779,780,781,782,783,800,801,818,819,791,792)
            OR
        (er.campaign_kind_id = 215 AND er.customer_id = 4454))
        AND e.state = 'completed' 
    `,

    getRequestsQueryTiketId: `
    SELECT wr.request_id tiketId, ck.*, er.*, ea.*, i.*, er.id as id_request, e.id as id_entrust, er.created_at as date_create_entrust,er2.author_id ,e.entrust_code,er2.codici_fiscali as codicifiscaliandcustomcode,ck.name as ck_name
    from entrust_requests as er  -- Tablella richieste
    	inner join campaign_kinds ck on er.campaign_kind_id = ck.id -- Tabella servizi
    	inner join entrusts as e on er.id = e.entrust_request_id -- tabella affidi
    	inner join entrust_assignments as ea on e.id = ea.entrust_id -- dettaglio affidi
        inner join entrust_requests er2 on er2.id = e.entrust_request_id  -- entrust_request
    	inner join investigated_subjects as i on ea.investigated_subject_id = i.id -- tabella dettaglio Codici fiscali
        inner join webservice_requests wr ON i.codice_fiscale = wr.codice_fiscale and ck.code = wr.code and wr.customer = 'CRIBIS' AND wr.massiva AND (wr.evaso is NULL OR evaso = 0)
    where
        (er.campaign_kind_id in (683,684,787,693,694,695,696,698,699,700,701,702,789,790,703,704,875,396,705,706,707,708,709,711,712,786,713,784,714,785,715,716,811,768,769,779,780,781,782,783,800,801,818,819,791,792)
            OR
        (er.campaign_kind_id = 215 AND er.customer_id = 4454))
        AND e.state = 'completed' 
    `,

    getRequestsQueryForControl: `
    Select ck.*, er.*, ea.*, i.*, er.id as id_request, e.id as id_entrust, er.created_at as date_create_entrust,er2.author_id,er2.codici_fiscali as codiciFiscaliAndCustomCode,ck.name as ck_name
    from entrust_requests as er  -- Tablella richieste
    	inner join campaign_kinds ck on er.campaign_kind_id = ck.id -- Tabella servizi
    	inner join entrusts as e on er.id = e.entrust_request_id -- tabella affidi
    	inner join entrust_assignments as ea on e.id = ea.entrust_id -- dettaglio affidi
        inner join entrust_requests er2 on er2.id = e.entrust_request_id  -- entrust_request
    	inner join investigated_subjects as i on ea.investigated_subject_id = i.id -- tabella dettaglio Codici fiscali
    where
        (er.campaign_kind_id in (683,684,787,693,694,695,696,698,699,700,701,702,789,790,703,704,875,396,705,706,707,708,709,711,712,786,713,784,714,785,715,716,811,768,769,779,780,781,782,783,800,801,818,819,791,792)
            OR
        (er.campaign_kind_id = 215 AND er.customer_id = 4454))        
        and e.state = 'new_entrust'
    `,
}

export const generateQueryVerifyClosedAllEntrust = (state : string) =>{
    return PostgresQuery.getRequestsQuery + `AND ea.state <> '${state}'`
}

export const generateQueryVerifyClosedEntrust = (entrust_id : string) =>{
    return `${generateQueryVerifyClosedAllEntrust('validated')} AND e.id = '${entrust_id}'`
}

export const generateQueryVerifyNewEntrust = (entrust_id : string) =>{
    return PostgresQuery.getRequestsQueryForControl + `AND ea.state <> 'preparation' AND e.id = '${entrust_id}'`
}


export const generateRequestsQueryForTaked = () =>{
    return PostgresQuery.getRequestsQuery
     + `AND ea.state = 'closed'`
}


export const setStateEntrustsRequest = (id: string,state:string,now: string) => {
    return `
    UPDATE entrust_requests
	SET "state" = '${state}',"completed_at" = to_timestamp('${now}','DD/MM/YYYY HH24:MI:SS'),"updated_at" = to_timestamp('${now}','DD/MM/YYYY HH24:MI:SS')
	WHERE id = ${id};`

}
export const setStateEntrusts = (id: string,state:string,now: string) => {
    return `
    UPDATE entrusts
	SET "state" = '${state}',"updated_at" = to_timestamp('${now}','DD/MM/YYYY HH24:MI:SS')
	WHERE id = ${id};`
}

export const setStateEntrustsAssignment = (investigation_record_id: string,state:string,now: string) => {
    return `
    UPDATE entrust_assignments
	SET "state" = '${state}',"updated_at" = to_timestamp('${now}','DD/MM/YYYY HH24:MI:SS')
	WHERE investigation_record_id = ${investigation_record_id};`
}

export const generateQueryRecapitiTelefonici = (investigation_record_id: string, note = 0 ) => {
    if(note === 1){
        return `Select * from recapiti_telefonici where investigation_record_id = ${investigation_record_id};`
    } else {
        return `Select * from recapiti_telefonici where investigation_record_id = ${investigation_record_id} and numero <> '' and numero is not null;`
    }
}

export const generateQueryRecapitiTelefoniciRappresentati = (investigation_record_id: string, note = 0) => {
    if(note === 1){
        return `Select *, telefono as numero from telefono_rappr_legali where investigation_record_id = ${investigation_record_id};`
    } else {
         return `Select *, telefono as numero from telefono_rappr_legali where investigation_record_id = ${investigation_record_id} and telefono <> '' and telefono is not null;`
    }
}

export const generateQueryContiCorrenti = (investigation_record_id: string) => {
    return `Select * from conti_correnti where investigation_record_id = ${investigation_record_id};`
}

export const generateQueryProprieta = (investigation_record_id: string) => {
    return `Select * from proprieta where investigation_record_id = ${investigation_record_id};`
}

export const generateQueryLocazioniRecords = (investigation_record_id: string) => {
    return `Select * from locazioni where investigation_record_id = ${investigation_record_id};`
}

export const generateQueryLocazioniRappLegaliRecords = (investigation_record_id: string) => {
    return `Select * from locazione_rappr_legali where investigation_record_id = ${investigation_record_id};`
}

export const generateQueryInvestigationRecords = (investigation_record_id: string) => {
    return `Select * from investigation_records where id = ${investigation_record_id};`
}

export const generateQueryEntrustsId = (entrust_request_id: string) => {
    return `Select id from entrusts e where e.entrust_request_id = ${entrust_request_id};`
}

export const generateQueryInsertAttachments = (input: InsertAttachments) => {
    return `Insert into attachments (file_file_name, file_content_type, file_file_size, file_updated_at, user_id, uploaded_at, entrust_id, created_at, updated_at)
    Values('${input.file_file_name}', '${input.file_content_type}', ${input.file_file_size}, to_timestamp('${input.file_updated_at}', 'DD/MM/YYYY HH24:MI:SS'), ${input.user_id}, to_timestamp ('${input.uploaded_at}', 'DD/MM/YYYY HH24:MI:SS'), ${input.entrust_id}, to_timestamp ('${input.created_at}', 'DD/MM/YYYY HH24:MI:SS'), to_timestamp ('${input.updated_at}', 'DD/MM/YYYY HH24:MI:SS'))
    returning id;`
}

export const generateQueryUpdateAttachments = (input: InsertAttachments,idOfAttachments : any) => {
    return `Update attachments set file_content_type = '${input.file_content_type}', file_file_size = ${input.file_file_size}, file_updated_at = to_timestamp('${input.file_updated_at}', 'DD/MM/YYYY HH24:MI:SS'),entrust_id = ${input.entrust_id},updated_at =to_timestamp('${input.updated_at}', 'DD/MM/YYYY HH24:MI:SS')
    where id = ${idOfAttachments.id}`
}

export const generateQuerySelectAttachments = (fileName: string) => {
    return `Select id from attachments where file_file_name = '${fileName}' order by id desc`
}

export const generateQuerySelectAttachmentsByEntrustId = (entrust_id: string,filename:string) => {
    return `Select id from attachments where entrust_id = '${entrust_id}' AND file_file_name like '%${filename}%' order by id desc`
}


export const generateQueryReperibilita = (investigation_record_id: string) => {
    return `Select * from domicili where investigation_record_id = ${investigation_record_id};`
}

export const generateQueryPersonaFisica = (investigation_record_id: string) => {
    return `Select ir.*, i.*
        from investigation_records as ir 
        INNER JOIN entrust_assignments ea ON ir.id = ea.investigation_record_id
        inner join investigated_subjects as i ON ea.investigated_subject_id = i.id
        WHERE ir.id = ${investigation_record_id};`
}

export const generateQueryLegaleRappresentante = (investigation_record_id: string) => {
    return `Select * from amministratori_condomini where investigation_record_id = ${investigation_record_id};`
}

export const generateQueryAttivitaLavorativa = (investigation_record_id: string) => {
    return `Select * from lavori where investigation_record_id = ${investigation_record_id};`
}

export const generateQueryPensioni = (investigation_record_id: string) => {
    return `Select * from pensioni where investigation_record_id = ${investigation_record_id};`
}

export const generateQueryErediAccettanti = (investigation_record_id: string) => {
    return `Select * from eredi_accettanti where investigation_record_id = ${investigation_record_id}
    and codice_fiscale is not null;`
}
export const generateQueryErediChiamati = (investigation_record_id: string) => {
    return `Select * from eredi_chiamati where investigation_record_id = ${investigation_record_id};`
}

export const generateQueryPRA = (investigation_record_id: string) => {
    return `Select * from pra where investigation_record_id = ${investigation_record_id};`
}

export const generateQueryPRARapprLegal = (investigation_record_id: string) => {
    return `Select * from pra_rappr_legali where investigation_record_id = ${investigation_record_id};`
}

export const generateQueryRapportiBancariLegaleRappresentante = (investigation_record_id: string) => {
    return `Select * from rapporto_bancario_rappr_legali where investigation_record_id = ${investigation_record_id};`
}

export const generateQueryPrejudical = (investigation_record_id: string) => {
    return `Select * from pregiudizievoli_conservatoria where investigation_record_id = ${investigation_record_id};`
}

export const generateQueryApprofondimentiIpotecari = (investigation_record_id: string) => {
    return `SELECT approfondimento_ipotecario__note FROM investigation_records WHERE id = ${investigation_record_id};`
}
export const generateQueryOperativitaSocieta = (investigation_record_id: string) => {
    return `SELECT operativita_societa__note FROM investigation_records WHERE id = ${investigation_record_id};`
}
export const generateQueryApprofondimentiIpotecariRapprLegale = (investigation_record_id: string) => {
    return `SELECT approfondimento_ipotecario_rappr_legale__note FROM investigation_records WHERE id = ${investigation_record_id};`
}


export const generateQueryNoteConservatoria = (investigation_record_id: string) => {
    return `SELECT note_da_conservatoria FROM proprieta WHERE id = ${investigation_record_id};`
}

export const generateQueryNoteConservatoriaByCodiceFiscale = (codice_fiscale: string) => {
    return `SELECT pr.note_da_conservatoria 
        FROM proprieta pr
        inner join investigated_subjects is2 on is2.codice_fiscale = '${codice_fiscale}'
        inner join investigation_records ir on ir.investigated_subject_id  =is2.id 
        where pr.investigation_record_id  = ir.id;`
}



export async function insertJsonReportToCiro(conn: Sequelize, ticketId: any, customer: any, dati: any){
    if (ticketId === '' || ticketId === undefined || ticketId === null) return false
    return await conn.query(
        `
          UPDATE webservice_requests
          SET dati = :payload::jsonb
          WHERE request_id = :requestId AND customer = :customer
        `,
        {
          replacements: {
            payload: JSON.stringify(dati),
            requestId: dati.informazioneN,
            customer: customer
          }
        }
      )
}

//Query parzialmente completa
// personaGiuridicaQuery: `
//     Select ck.*, er.*, ea.*, i.*, cc.*, rt.*
//     from entrust_requests as er  -- Tablella richieste
//     	inner join campaign_kinds ck on er.campaign_kind_id = ck.id -- Tabella servizi
//     	inner join entrusts as e on er.id = e.entrust_request_id -- tabella affidi
//     	inner join entrust_assignments as ea on e.id = ea.entrust_id -- dettaglio affidi
//     	inner join investigated_subjects as i on ea.investigated_subject_id = i.id -- tabella dettaglio Codici fiscali
// 		inner join conti_correnti as cc on ea.investigation_record_id = cc.investigation_record_id --tabella rapporti bancari
// 		inner join recapiti_telefonici as rt on ea.investigation_record_id = rt.investigation_record_id --tabella recapiti telefonici
// 		inner join proprieta as p on ea.investigation_record_id = p.investigation_record_id --tabella veicoli e immobili
// 	   -- inner join cariche as pa on ea.investigation_record_id = pa.investigation_record_id --tabella rapporti bancari
// 	where
//     	er.customer_id = 20 and er.campaign_kind_id = 698 and e.state = 'completed'
//     `

/*
    Select ck.*, er.*, ea.*, i.*
    from entrust_requests as er  -- Tablella richieste
        inner join campaign_kinds ck on er.campaign_kind_id = ck.id -- Tabella servizi
        inner join entrusts as e on er.id = e.entrust_request_id -- tabella affidi
        inner join entrust_assignments as ea on e.id = ea.entrust_id -- dettaglio affidi
        inner join investigated_subjects as i on ea.investigated_subject_id = i.id -- tabella dettaglio Codici fiscali
    where
        er.campaign_kind_id = 698 and e.state = 'completed'
*/