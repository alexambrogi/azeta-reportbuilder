import moment from "moment";
import { convertBuilding, convertDomicilio, convertVeicoli, findLegalRepresentative, findMainDocumentMongoReportImprenditore, findMainDocumentMongoPersonaFisica, findProspectHistoryMongo, getAnagraficaImpresa, getAnagraficaPersonaFisica, getAttivitaLavorativa, getBankingRelationshipsLegalRepresentative, getLegaleRappresentante, getPrejudical, getRapportiBancari, getRecapitiTelefonici, valueFromResponsePurchase } from "../utils";
import { Sequelize } from "sequelize";
import { getNegativity } from "./persona-fisica.converter";
import { generateQueryInvestigationRecords } from "../database/postgres/query/postgres.query";
import { Veicolo } from "../models/persona-fisica.model";
import { getAnagraficaImpresaGiuridica, getLegaleRappresentantePersonalData, getNegativityGiuridica } from "./persona-giuridica.converter";

export async function convertJsonIntoData(raw: any, list: Map<string, any>, pgConnection: Sequelize) {
    console.log('[inizio metodo]')
    let isFisica = false
    let isNoRea: any = false
    if (raw.campaign_kind_id.includes('713') || raw.campaign_kind_id.includes('768'))
        isFisica = true;

    const dateOfRequest = moment(raw.date_create_entrust).format('DD/MM/YYYY');
    let anagrafica: any = false
    let negativity: any = false
    let index = list.get(raw.campaign_kind_id).length
    let rappresentanteLegale: any;
    const prospectHistoryResponse: any = null;
    if (isFisica) {
        let productPurchaseResponse: any = await findMainDocumentMongoReportImprenditore(raw.id_request, raw.codice_fiscale, dateOfRequest, raw.investigation_record_id)
        if (productPurchaseResponse === false) {
            let productPurchaseResponse: any = await findMainDocumentMongoPersonaFisica(raw.id_request, raw.codice_fiscale, dateOfRequest, raw.investigation_record_id)
        }
        anagrafica = await getAnagraficaPersonaFisica(raw.investigation_record_id, pgConnection);
        const valueFromResp = await valueFromResponsePurchase(productPurchaseResponse?.json)
        negativity = getNegativity(valueFromResp);
    } else {
        // const productPurchaseResponse: any = await findProductPurchaseMongo(raw.id_request, raw.codice_fiscale, dateOfRequest, raw.investigation_record_id)
        const productPurchaseResponse : any = true
        if (productPurchaseResponse === true) {
            if (['714'].includes(raw.campaign_kind_id) || ['769'].includes(raw.campaign_kind_id)) {
                isNoRea = await getAnagraficaImpresa(raw.investigation_record_id, pgConnection);
                index = list.get(raw.campaign_kind_id + '_NR').length
            }
        }
        if(isNoRea){
            rappresentanteLegale = await getLegaleRappresentante(raw.investigation_record_id,null,pgConnection);
            rappresentanteLegale.relationshipLegal = await getBankingRelationshipsLegalRepresentative(raw.investigation_record_id, pgConnection);
        }else{
            const responsePersonaFisica = await findLegalRepresentative(productPurchaseResponse?.json?.CompanyReport?.OfficialDirectors?.Director[1]?.Individual?.TaxCode?._text, dateOfRequest, raw.investigation_record_id)
            rappresentanteLegale = getLegaleRappresentantePersonalData(responsePersonaFisica);
            rappresentanteLegale.relationshipLegal = await getBankingRelationshipsLegalRepresentative(raw.investigation_record_id, pgConnection)
        }
        const prospectHistoryResponse: any = await findProspectHistoryMongo(raw.id_request, raw.codice_fiscale, dateOfRequest, raw.investigation_record_id, productPurchaseResponse.request_id)
        anagrafica = getAnagraficaImpresaGiuridica(productPurchaseResponse?.json?.CompanyReport?.ItemInformation, prospectHistoryResponse?.json?.COCCompanyReport?.CompanyActivitySection, productPurchaseResponse?.json?.COCCompanyReport?.Activity, prospectHistoryResponse?.json?.COCCompanyReport?.InformationOnIncorporationSection, isNoRea)
        let prejudicial = await getPrejudical(raw.investigation_record_id, pgConnection)
        if (prejudicial === false) return [false, false]
        negativity = getNegativityGiuridica(productPurchaseResponse?.json?.CompanyReport?.Protests, prejudicial, productPurchaseResponse?.json?.CompanyReport?.Bankruptcy);
    }
    if (anagrafica === false) return [false, false]
    if (negativity === false) return [false, false]
    const telefoni = await getRecapitiTelefonici(raw.investigation_record_id, pgConnection);
    if (telefoni === false) return [false, false]

    const rapportiBancari = await getRapportiBancari(raw.investigation_record_id, pgConnection)
    if (rapportiBancari === false) return [false, false]

    const [resultInvestigationRecordSrl, metadataInvestigationRecordSrl] = await pgConnection.query(generateQueryInvestigationRecords(raw.investigation_record_id));
    let domicili: any[] = [];
    let veicoli: { vehiclesSocieta: Veicolo[]; vehiclesPersona: Veicolo[]; } = { vehiclesSocieta: [], vehiclesPersona: [] };
    if (resultInvestigationRecordSrl.length) {
        veicoli = convertVeicoli(resultInvestigationRecordSrl)
        domicili = convertDomicilio(resultInvestigationRecordSrl)

    }
    console.log('[inizio attivita')

    const attivitaLavorativa = await getAttivitaLavorativa(raw.investigation_record_id, pgConnection);
    if (attivitaLavorativa === false) return [false, false]

    console.log('[inizio conversione]')
    return isFisica ? [false, {

        'Progressivo': index + 1,
        cod_discale: raw.codice_fiscale,
        tipo_elab: 'cribis_search_l',
        nome_prodotto: 'Cribis SEARCH Light',
        cognome: '',
        nome: '',
        denominaz: raw.nome +" "+ raw.cognome,
        codfisc: raw.codice_fiscale,
        comRes: '',
        sede: '',
        indirizzo: '',
        telefono: '',
        cellulare: '',
        note: '',
        urgente: '',

        'Cognome': anagrafica.surname,
        'Nome': anagrafica.name,
        'Data Di Nascita': anagrafica.dateOfBirth,
        'Provincia': anagrafica.province,
        'Comune': anagrafica.municipality,
        'Codice Fiscale': anagrafica.cf,
        'Utenze Telefoniche': telefoni.map(telefono => telefono.contact).join(';'),
        'Note Utenze': telefoni.map(telefono => telefono.note).join('-'),
        'Codice Fiscale Aggiornato': '',
        'Verifiche Anagrafiche': domicili?.length ? 'CONFERMATA' : 'RESIDENTE',
        'Dati Residenza ': '',
        'Indirizzo': getIndirizzo(domicili, resultInvestigationRecordSrl),
        'Cap': (resultInvestigationRecordSrl as any)[0].residenza__indirizzo_via,
        'Comune ': (resultInvestigationRecordSrl as any)[0].residenza__indirizzo_comune,
        'Provincia ': (resultInvestigationRecordSrl as any)[0].residenza__indirizzo_provincia,
        'Data Decesso': (resultInvestigationRecordSrl as any).data_decesso,
        'Flag occupazione': attivitaLavorativa.activityJob.length ? 'PRESENTE' : 'NON PRESENTE',
        'Categoria': attivitaLavorativa.activityJob.length ? attivitaLavorativa.activityJob[0].jobTitle : '',
        'Datore Di Lavoro': attivitaLavorativa.activityJob.length || attivitaLavorativa.pension.length ? attivitaLavorativa.activityJob.map(job => job.ownerName || '').join('+') + attivitaLavorativa.pension.map(job => job.entityCompanyName || '').join('+') : '',
        'Partita Iva': attivitaLavorativa.activityJob.length || attivitaLavorativa.pension.length ? attivitaLavorativa.activityJob.map(job => job.ownerCf || '').join('+') + attivitaLavorativa.pension.map(job => job.ivaCodeCompanyName || '').join('+') : '',
        'Codice Fiscale ': attivitaLavorativa.activityJob.length || attivitaLavorativa.pension.length ? attivitaLavorativa.pension.map(job => job.taxCodeCompanyName || '').join('+') : '',
        'Indirizzo ': attivitaLavorativa.activityJob.length || attivitaLavorativa.pension.length ? attivitaLavorativa.activityJob.map(job => job.indirizzo || '').join('+') + attivitaLavorativa.pension.map(job => job.indirizzo || '').join('+') : '',
        'Cap ': attivitaLavorativa.activityJob.length || attivitaLavorativa.pension.length ? attivitaLavorativa.activityJob.map(job => job.cap || '').join('+') + attivitaLavorativa.pension.map(job => job.cap || '').join('+') : '',
        'Comune  ': attivitaLavorativa.activityJob.length || attivitaLavorativa.pension.length ? attivitaLavorativa.activityJob.map(job => job.comune || '').join('+') + attivitaLavorativa.pension.map(job => job.comune || '').join('+') : '',
        'Pronvincia ': attivitaLavorativa.activityJob.length || attivitaLavorativa.pension.length ? attivitaLavorativa.activityJob.map(job => job.provincia || '').join('+') + attivitaLavorativa.pension.map(job => job.provincia || '').join('+') : '',
        'Emolumenti': attivitaLavorativa.activityJob.length || attivitaLavorativa.pension.length ? attivitaLavorativa.activityJob.map(job => job.remunerationGross || '').join('+') + attivitaLavorativa.pension.map(job => job.remunerationGross || '').join('+') : '',
        'Note': attivitaLavorativa.activityJob.length || attivitaLavorativa.pension.length ? attivitaLavorativa.activityJob.map(job => job.verificationNote || '').join('+') : '',
        'Verifiche Occupazione': attivitaLavorativa.activityJob.length || attivitaLavorativa.pension.length ? attivitaLavorativa.activityJob.map(job => job.jobType || '').join('+') + attivitaLavorativa.pension.map(job => job.type || '').join('+') : '',
        'Flag Banca': rapportiBancari.length ? 'PRESENTI' : 'NON PRESENTI',
        'Stato Rapporto': rapportiBancari.length ? 'ATTIVO' : 'CENSITO',
        'Istituto Bancario': rapportiBancari.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.businessName).join('+') : '',
        'ABI': rapportiBancari.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.abi).join('+') : '',
        'CAB': rapportiBancari.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.cab).join('+') : '',
        'P.Iva/Cod.Fiscale': rapportiBancari.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.piva).join('+') : '',
        'Indirizzo  ': rapportiBancari.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.address).join('+') : '',
        'Cap  ': rapportiBancari.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.cap).join('+') : '',
        'Comune   ': rapportiBancari.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.city).join('+') : '',
        'Provincia  ': rapportiBancari.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.province).join('+') : '',
        'Flag Immobili': (await convertBuilding(raw.codice_fiscale, true)).find ? 'SI' : 'NO',
        'Protesti': negativity.protests.flag ? 'SI' : 'NO',
        'Pregiudizievoli': negativity.prejudicial.value ? 'SI' : 'NO',
        'Procedure Concorsuali': negativity.insolvencyProceedings ? 'SI' : 'NO',
        'Flag Veicoli': veicoli.vehiclesPersona.length || veicoli.vehiclesSocieta.length ? 'SI' : 'NO',


    }] : isNoRea ? [true, {
        'Progressivo': index + 1,
        'cod_discale': raw.codice_fiscale,
        'tipo_elab': 'cribis_search_l',
        'nome prodotto': 'Cribis SEARCH Light',
        'cognome': '',
        'nome': '',
        'denominaz': raw.nome + raw.cognome,
        'codfisc': raw.codice_fiscale,
        'comRes': '',
        'sede': '',
        'indirizzo': '',
        'telefono': '',
        'cellulare': '',
        'note': '',
        'urgente': '',

        'Ragione Sociale': anagrafica.businessName,
        'Codice Fiscale': anagrafica.taxCode ? anagrafica.taxCode : anagrafica.iva,
        'Partita IVA': anagrafica.iva ? anagrafica.iva : anagrafica.taxCode,
        'Indirizzo': anagrafica.address ? anagrafica.address : '',
        'Cap': anagrafica.cap ? anagrafica.cap : '',
        'Comune': anagrafica.municipality ? anagrafica.municipality : '',
        'Provincia': anagrafica.province,
        'Forma Giuridica': anagrafica.legalForm,
        'Data Registrazione': anagrafica.startCompanyDate,
        'Stato Attività': anagrafica.stateOfCompany,
        'Data Cessazione': anagrafica.expectedEndDate,
        'Verifiche Anagrafiche': 'CONFERMATA',
        'Utenze Telefoniche': telefoni.map(telefono => telefono.contact).join(';'),
        'Note Utenze': telefoni.map(telefono => telefono.note).join('-'),
        'Flag Banca': rapportiBancari.length ? 'PRESENTI' : ' NON PRESENTI',
        'Stato Rapporto': rapportiBancari.length ? 'ATTIVO' : 'CENSITO',
        'Istituto Bancario': rapportiBancari.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.businessName).join('+') : '',
        'Abi': rapportiBancari.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.abi).join('+') : '',
        'Cab': rapportiBancari.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.cab).join('+') : '',
        'P.Iva/Cod.Fiscale': rapportiBancari.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.piva).join('+') : '',
        'Indirizzo ': rapportiBancari.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.address).join('+') : '',
        'Cap ': rapportiBancari.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.cap).join('+') : '',
        'Comune ': rapportiBancari.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.city).join('+') : '',
        'Pronvincia ': rapportiBancari.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.province).join('+') : '',
        'Flag Immobili': (await convertBuilding(raw.codice_fiscale, true)).find ? 'SI' : 'NO',
        'Protesti': negativity.protests.flag ? 'SI' : 'NO',
        'Pregiudizievoli': negativity.prejudicial.value ? 'SI' : 'NO',
        'Procedure Concorsuali': negativity.insolvencyProceedings.value ? 'SI' : 'NO',
        'Flag Veicoli': veicoli.vehiclesPersona.length || veicoli.vehiclesSocieta.length ? 'SI' : 'NO',
        'Cognome' : rappresentanteLegale.surname,
        'Nome' : rappresentanteLegale.name,
        'Data di nascita': rappresentanteLegale.dateOfBirth,
        'Luogo di nascita' : `${rappresentanteLegale.placeOfBirth} (${rappresentanteLegale.provinceOfBirth})`,
        'Codice Fiscale ': rappresentanteLegale.cf,
        'Codice Fiscale Aggiornato' : '',
        'Verifiche Anagrafiche ': '',
        'Indirizzo  ': getIndirizzo(domicili, resultInvestigationRecordSrl),
        'Cap  ': (resultInvestigationRecordSrl as any)[0]?.residenza__indirizzo_via,
        'Comune  ': (resultInvestigationRecordSrl as any)[0]?.residenza__indirizzo_comune,
        'Provincia ': (resultInvestigationRecordSrl as any)[0]?.residenza__indirizzo_provincia,
        'Recapito': telefoni.map(telefono => telefono.contact).join(';'),
        'Nota': telefoni.map(telefono => telefono.note).join('-'),
    }] : [false, {
        'Progressivo': index + 1,
        'cod_discale': raw.codice_fiscale,
        'tipo_elab': 'cribis_search_l',
        'nome prodotto': 'Cribis SEARCH Light',
        'cognome': '',
        'nome': '',
        'denominaz': raw.nome + raw.cognome,
        'codfisc': raw.codice_fiscale,
        'comRes': '',
        'sede': '',
        'indirizzo': '',
        'telefono': '',
        'cellulare': '',
        'note': '',
        'urgente': '',
        'Ragione Sociale': anagrafica.businessName || '',
        'Codice Fiscale': anagrafica.taxCode ? anagrafica.taxCode : anagrafica.iva || '',
        'Partita IVA': anagrafica.iva ? anagrafica.iva : anagrafica.taxCode || '',
        'Indirizzo': anagrafica.address || '',
        'Cap': anagrafica.cap || '',
        'Comune': anagrafica.municipality || '',
        'Provincia': anagrafica.province || '',
        'Numero REA': anagrafica.codeREA || '',
        'Descrizione Tipo Attività': anagrafica.activity || '',
        'Stato Attività': anagrafica.stateOfCompany || '',
        'Data Cessazione': anagrafica.expectedEndDate || '',
        'Verifiche Anagrafiche': 'CONFERMATA',
        'Utenze Telefoniche': telefoni.map(telefono => telefono.contact).join(';') + (prospectHistoryResponse?.json?.COCCompanyReport?.CompanyIdentificationSection?.RHOPhone?.TelNo?._text ? `081/${prospectHistoryResponse?.json?.COCCompanyReport?.CompanyIdentificationSection?.RHOPhone?.TelNo?._text}` : ''),
        'Note Utenze': telefoni.map(telefono => telefono.note).join('-'),
        'Flag Banca': rapportiBancari?.length ? 'PRESENTI' : 'NON PRESENTI',
        'Stato Rapporto': rapportiBancari?.length ? 'ATTIVO' : 'CENSITO',
        'Istituto Bancario': rapportiBancari?.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.businessName).join('+') : '',
        'Abi': rapportiBancari?.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.abi).join('+') : '',
        'Cab': rapportiBancari?.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.cab).join('+') : '',
        'P.Iva/Cod.Fiscale': rapportiBancari?.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.piva).join('+') : '',
        'Indirizzo ': rapportiBancari?.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.address).join('+') : '',
        'Cap ': rapportiBancari?.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.cap).join('+') : '',
        'Comune ': rapportiBancari?.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.city).join('+') : '',
        'Pronvincia ': rapportiBancari?.length ? rapportiBancari.map(rapportoBancario => rapportoBancario.province).join('+') : '',
        'Flag Immobili': (await convertBuilding(raw.codice_fiscale, true)).find ? 'SI' : 'NO',
        'Protesti': negativity?.protests.flag ? 'SI' : 'NO',
        'Pregiudizievoli': negativity?.prejudicial.value ? 'SI' : 'NO',
        'Procedure Concorsuali': negativity?.insolvencyProceedings.value ? 'SI' : 'NO',
        'Flag Veicoli': veicoli?.vehiclesPersona.length || veicoli?.vehiclesSocieta.length ? 'SI' : 'NO',
        'Cognome' : rappresentanteLegale?.lastName,
        'Nome' : rappresentanteLegale?.firstName,
        'Data di nascita': rappresentanteLegale?.dateOfBirth,
        'Luogo di nascita' : `${rappresentanteLegale?.placeOfBirth || ''} ${rappresentanteLegale?.provinceOfBirth ? (rappresentanteLegale?.provinceOfBirth) : ''}`,
        'Codice Fiscale ': rappresentanteLegale?.taxIdCode,
        'Recapito': telefoni.map(telefono => telefono.contact).join(';'),
        'Nota': telefoni.map(telefono => telefono.note).join('-'),
        'Codice Fiscale Aggiornato' : '',
        'Verifiche Anagrafiche ': domicili?.length ? 'CONFERMATA' : 'RESIDENTE',
        'Indirizzo  ': getIndirizzo(domicili, resultInvestigationRecordSrl),
        'Cap  ': (resultInvestigationRecordSrl as any)[0]?.residenza__indirizzo_via,
        'Comune  ': (resultInvestigationRecordSrl as any)[0]?.residenza__indirizzo_comune,
        'Provincia ': (resultInvestigationRecordSrl as any)[0]?.residenza__indirizzo_provincia,
        'Data Decesso': (resultInvestigationRecordSrl as any)?.data_decesso,
        'Flag occupazione': attivitaLavorativa?.activityJob.length ? 'PRESENTE' : 'NON PRESENTE',
        'Categoria': attivitaLavorativa?.activityJob.length ? attivitaLavorativa?.activityJob[0].jobTitle : '',
        'Datore Di Lavoro': attivitaLavorativa?.activityJob.length || attivitaLavorativa?.pension.length ? attivitaLavorativa.activityJob.map(job => job.ownerName || '').join('+') + attivitaLavorativa.pension.map(job => job.entityCompanyName || '').join('+') : '',
        'Partita Iva': attivitaLavorativa?.activityJob.length || attivitaLavorativa?.pension.length ? attivitaLavorativa.activityJob.map(job => job.ownerCf || '').join('+') + attivitaLavorativa.pension.map(job => job.ivaCodeCompanyName || '').join('+') : '',
        'Codice Fiscale  ': attivitaLavorativa?.activityJob.length || attivitaLavorativa?.pension.length ? attivitaLavorativa.pension.map(job => job.taxCodeCompanyName || '').join('+') : '',
        'Indirizzo   ': attivitaLavorativa?.activityJob.length || attivitaLavorativa?.pension.length ? attivitaLavorativa.activityJob.map(job => job.indirizzo || '').join('+') + attivitaLavorativa.pension.map(job => job.indirizzo || '').join('+') : '',
        'Cap   ': attivitaLavorativa?.activityJob.length || attivitaLavorativa?.pension.length ? attivitaLavorativa.activityJob.map(job => job.cap || '').join('+') + attivitaLavorativa.pension.map(job => job.cap || '').join('+') : '',
        'Comune   ': attivitaLavorativa?.activityJob.length || attivitaLavorativa?.pension.length ? attivitaLavorativa.activityJob.map(job => job.comune || '').join('+') + attivitaLavorativa.pension.map(job => job.comune || '').join('+') : '',
        'Pronvincia  ': attivitaLavorativa?.activityJob.length || attivitaLavorativa?.pension.length ? attivitaLavorativa.activityJob.map(job => job.provincia || '').join('+') + attivitaLavorativa.pension.map(job => job.provincia || '').join('+') : '',
        'Emolumenti': attivitaLavorativa?.activityJob.length || attivitaLavorativa?.pension.length ? attivitaLavorativa.activityJob.map(job => job.remunerationGross || '').join('+') + attivitaLavorativa.pension.map(job => job.remunerationGross || '').join('+') : '',
        'Note': attivitaLavorativa?.activityJob.length || attivitaLavorativa?.pension.length ? attivitaLavorativa.activityJob.map(job => job.verificationNote || '').join('+') : '',
        'Verifiche Occupazione': attivitaLavorativa?.activityJob.length || attivitaLavorativa?.pension.length ? attivitaLavorativa.activityJob.map(job => job.jobType || '').join('+') + attivitaLavorativa.pension.map(job => job.type || '').join('+') : '',
        'Flag Banca ': rappresentanteLegale?.relationshipLegal ? 'PRESENTI' : 'NON PRESENTI',
        'Stato Rapporto ': rappresentanteLegale?.relationshipLegal ? 'ATTIVO' : 'CENSITO',
        'Istituto Bancario ': rappresentanteLegale?.relationshipLegal ? rappresentanteLegale.relationshipLegal.map((rapportoBancario: any) => rapportoBancario.bankCompanyName).join('+') : '',
        'ABI': rappresentanteLegale?.relationshipLegal ? rappresentanteLegale.relationshipLegal.map((rapportoBancario: any) => rapportoBancario.abi).join('+') : '',
        'CAB': rappresentanteLegale?.relationshipLegal ? rappresentanteLegale.relationshipLegal.map((rapportoBancario: any) => rapportoBancario.cab).join('+') : '',
        'P.Iva/Cod.Fiscale ': rappresentanteLegale?.relationshipLegal ? rappresentanteLegale.relationshipLegal.map((rapportoBancario: any) => rapportoBancario.bankVATNumber).join('+') : '',
        'Indirizzo    ': rappresentanteLegale?.relationshipLegal ? rappresentanteLegale.relationshipLegal.map((rapportoBancario: any) => rapportoBancario.address).join('+') : '',
        'Cap    ': rappresentanteLegale?.relationshipLegal ? rappresentanteLegale.relationshipLegal.map((rapportoBancario: any) => rapportoBancario.postalAddress).join('+') : '',
        'Comune    ': rappresentanteLegale?.relationshipLegal ? rappresentanteLegale.relationshipLegal.map((rapportoBancario: any) => rapportoBancario.commonAddress).join('+') : '',
        'Provincia  ': rappresentanteLegale?.relationshipLegal ? rappresentanteLegale.relationshipLegal.map((rapportoBancario: any) => rapportoBancario.provinceAddress).join('+') : '',
        'Flag Immobili ': (await convertBuilding(raw.codice_fiscale, true)).find ? 'SI' : 'NO',
        'Flag Protesti': negativity?.protests?.flag ? 'SI' : 'NO',
        'Flag Pregiudizievoli': negativity?.prejudicial?.value ? 'SI' : 'NO',
        'Flag Procedure Concorsuali': negativity?.insolvencyProceedings ? 'SI' : 'NO'

    }];
}

function getIndirizzo(domicilio: any[], resultInvestigationRecordSrl: any) {
    if (domicilio.length) {
        return `${domicilio[0]?.address || ''}`
    } else {
        return `${resultInvestigationRecordSrl[0]?.residenza__indirizzo_toponimo || ''} ${resultInvestigationRecordSrl[0]?.residenza__indirizzo_via || ''} ${resultInvestigationRecordSrl[0]?.residenza__indirizzo_civico || ''}`
    }
}