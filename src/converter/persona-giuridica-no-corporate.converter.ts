import moment from "moment"
import { BankingRelationship, BankingRelationshipsLegalRepresentative, InvestigationRecords } from "../models/persona-giuridica.model"
import { getNoteTelefoniciRappresentante, getNoteTelefonici, CustomError, companyShareholdingsPersonaFisica, companyShareholdingsPersonaGiuridica, getRapportiBancariRappresentanteLegale, convertBuilding, convertDetailsPrejudicialPersonaFisica, convertObjectToArray, convertPrejudicialPersonaFisica, convertdescriptionInsolvencyProceedings, convertdescriptionProtest, convertdescriptionProtestPersonaFisica, findLegalRepresentative, generateBankingRelationships, getAnagraficaPersonaFisica, getApprofondimentiIpotecari, getAttivitaLavorativa, getBankingRelationshipsLegalRepresentative, getCaricheInImprese, getDetailsReperibilita, getInvestigationRecordsBySubjectLegalForm, getLegaleRappresentante, getOperativitaSocieta, getPrejudical, getRapportiBancari, getRecapitiTelefonici, getRecapitiTelefoniciRappresentante, getRecoverabilityJudgment, getReperibilita, getVeicoli, getVeicoliLegalRappr, returnArrayOfAttractiveMembers, valueFromResponsePurchase } from "../utils"
import { Sequelize } from "sequelize"
import { InputDataCustomer } from "../models/sftp.model"
import { ICribisPersonaGiuridicaNoCorporate } from "../models/persona-giuridica-no-corporate.model"
import { ExecutionJob } from "../models/logger.model"
import { calculateEsito, getAnagraficaImpresaGiuridica} from "./persona-giuridica.converter"
import { getInformazione } from "./money-plus-persona-giuridica.converter"
import { CodiciFiscaliAndCustomCode } from "../models/ciro.model"

export const personaGiuridicaNoCorporateConverter = async (
    pgConnection: Sequelize,
    investigation_record_id: string,
    codiceFiscale: string,
    dateOfRequest: string,
    campaign_kind_id: string,
    executionJob: ExecutionJob,
    codiciFiscaliAndCustomCode:CodiciFiscaliAndCustomCode[],
    customerInput?: InputDataCustomer,
    productPurchaseResponse?: { [key: string]: any },
    prospectHistoryResponse?: { [key: string]: any },
    isNoRea? : any,
    investigated_subject_id?:any,
): Promise<ICribisPersonaGiuridicaNoCorporate | false> => {
    const {
        ItemInformation,
        Activity,
        HoldingsFromShareholders,
        OfficialDirectors,
        Bankruptcy,
        Protests
    } = productPurchaseResponse?.CompanyReport || {};
    const {
        CompanyActivitySection,
        InformationOnIncorporationSection,
        WorkforceSection
    } = prospectHistoryResponse?.COCCompanyReport || {};
    const legalFormSubject = ItemInformation?.CompanyInformation?.CompanyForm?._attributes?.LegalFormDescription || '';

    //investigationRecord Compagnia
    const investigationRecords: InvestigationRecords | false = await getInvestigationRecordsBySubjectLegalForm(pgConnection, investigation_record_id)
    if (investigationRecords === false) return false

    //investigationRecord Legale Rappresentante
    const anagraficaRappresentante = await getAnagraficaPersonaFisica(investigation_record_id, pgConnection);
    if (anagraficaRappresentante === false) return false


    const domicilio = await getDetailsReperibilita(investigation_record_id, pgConnection)
    const {reperibilita,isReperibilita} = await getReperibilita(investigation_record_id, pgConnection,anagraficaRappresentante);
    if (reperibilita === null) return false
    const recapitiTelefonici = await getRecapitiTelefonici(investigation_record_id, pgConnection);
    if (recapitiTelefonici === false) return false
    const recapitiTelefoniciRappresentante = await getRecapitiTelefoniciRappresentante(investigation_record_id, pgConnection);
    if (recapitiTelefoniciRappresentante === false) return false

    const noteTelefoniciRappresentante = await getNoteTelefoniciRappresentante(investigation_record_id, pgConnection)
    if (noteTelefoniciRappresentante === false) return false
    const noteTelefonici = await getNoteTelefonici(investigation_record_id, pgConnection)
    if (noteTelefonici === false) return false
    
    const rapportiBancari = await getRapportiBancariRappresentanteLegale(investigation_record_id, pgConnection);
    if (rapportiBancari === false) return false
    const attivitaLavorativa = await getAttivitaLavorativa(investigation_record_id, pgConnection);
    if (attivitaLavorativa === false) return false
    const veicoli = await getVeicoli(investigation_record_id, pgConnection)
    if (veicoli === false) return false

    let director = Array.isArray(OfficialDirectors?.Director) ? OfficialDirectors?.Director[0] : OfficialDirectors?.Director

    //Legale Rappresentante
    const responseLegallyResponsible = await findLegalRepresentative(director?.Individual?.TaxCode?._text, dateOfRequest, investigation_record_id)
    const valuesPurchase = await valueFromResponsePurchase(responseLegallyResponsible?.json)
    if (valuesPurchase === false) return false
    const veicoliLegalRappr = await getVeicoliLegalRappr(investigation_record_id, pgConnection)
    if (veicoliLegalRappr === false) return false
    const relationshipLegal = await getBankingRelationshipsLegalRepresentative(investigation_record_id, pgConnection)
    if (relationshipLegal === false) return false
    const prejudicial = await getPrejudical(investigation_record_id, pgConnection)
    if(prejudicial === false) return false

    const approfondimentiIpotecari = await getApprofondimentiIpotecari(investigation_record_id, pgConnection)
    if(approfondimentiIpotecari === false) return false

    const operativita = await getOperativitaSocieta(investigation_record_id, pgConnection)
    if(operativita === false) return false

    try {
        const result = {
            informazioneN : getInformazione(codiciFiscaliAndCustomCode,codiceFiscale),
            campaign_kind_id,
            inputData: {
                dateOfRequest,
                releaseDate: moment(new Date()).format("DD/MM/YYYY"),
                numberInformation: '',
                refCustomer: customerInput?.refCustomer || ''
            },
            company: {
                registry: getAnagraficaImpresaGiuridica(ItemInformation,CompanyActivitySection,Activity,InformationOnIncorporationSection,isNoRea),
                annualEmployees: {
                    workforce: { //valori per colonna
                        year: WorkforceSection?.FoundWorkforceList?.FoundWorkforce?.Year?._text,
                        periodList: WorkforceSection?.FoundWorkforceList?.FoundWorkforce?.PeriodList?.Period?.map((period: any) => {
                            return {
                                employee: period.InternalWorkforceHeadcount?._text,
                                autonomous: period.ExternalWorkforceHeadcount?._text,
                                total: period.TotalWorkforceHeadcount?._text
                            }
                        }),
                        average: { //media valori per riga
                            employee: (WorkforceSection?.FoundWorkforceList?.FoundWorkforce?.PeriodList?.Period?.reduce((accumulator: any, object: any) => {
                                return (accumulator + parseInt(object.InternalWorkforceHeadcount?._text) || 0)
                            }, 0) / WorkforceSection?.FoundWorkforceList?.FoundWorkforce?.PeriodList?.Period?.filter((period: any) => !isNaN(parseInt(period.InternalWorkforceHeadcount?._text))).length) || 0,
                            autonomous: (WorkforceSection?.FoundWorkforceList?.FoundWorkforce?.PeriodList?.Period?.reduce((accumulator: any, object: any) => {
                                return (accumulator + parseInt(object.ExternalWorkforceHeadcount?._text) || 0)
                            }, 0) / WorkforceSection?.FoundWorkforceList?.FoundWorkforce?.PeriodList?.Period?.filter((period: any) => !isNaN(parseInt(period.ExternalWorkforceHeadcount?._text))).length) || 0,
                            total: (WorkforceSection?.FoundWorkforceList?.FoundWorkforce?.PeriodList?.Period?.reduce((accumulator: any, object: any) => {
                                return (accumulator + parseInt(object.TotalWorkforceHeadcount?._text) || 0)
                            }, 0) / WorkforceSection?.FoundWorkforceList?.FoundWorkforce?.PeriodList?.Period?.filter((period: any) => !isNaN(parseInt(period.TotalWorkforceHeadcount?._text))).length) || 0,
                        }
                    },
                    territorialWorkforce: {//valori per colonna
                        municipality: WorkforceSection?.WorkforceInformationOnTerritorialBasis?.OnMunicipalityBasisList?.OnMunicipalityBasis?.MunicipalityCode?._attributes?.description,
                        periodList: WorkforceSection?.WorkforceInformationOnTerritorialBasis?.OnMunicipalityBasisList?.OnMunicipalityBasis?.PeriodList?.Period?.map((period: any) => {
                            return {
                                employee: period.InternalWorkforceHeadcount?._text,
                                autonomous: period.ExternalWorkforceHeadcount?._text,
                                total: period.TotalWorkforceHeadcount?._text
                            }
                        }),
                        average: { //media valori per riga
                            employee: (WorkforceSection?.WorkforceInformationOnTerritorialBasis?.OnMunicipalityBasisList?.OnMunicipalityBasis?.PeriodList?.Period?.reduce((accumulator: any, object: any) => {
                                return (accumulator + parseInt(object.InternalWorkforceHeadcount._text) || 0)
                            }, 0) / WorkforceSection?.WorkforceInformationOnTerritorialBasis?.OnMunicipalityBasisList?.OnMunicipalityBasis?.PeriodList?.Period?.filter((period: any) => !isNaN(parseInt(period.InternalWorkforceHeadcount?._text))).length) || 0,
                            autonomous: (WorkforceSection?.WorkforceInformationOnTerritorialBasis?.OnMunicipalityBasisList?.OnMunicipalityBasis?.PeriodList?.Period?.reduce((accumulator: any, object: any) => {
                                return (accumulator + parseInt(object.ExternalWorkforceHeadcount._text) || 0)
                            }, 0) / WorkforceSection?.WorkforceInformationOnTerritorialBasis?.OnMunicipalityBasisList?.OnMunicipalityBasis?.PeriodList?.Period?.filter((period: any) => !isNaN(parseInt(period.ExternalWorkforceHeadcount?._text))).length) || 0,
                            total: (WorkforceSection?.WorkforceInformationOnTerritorialBasis?.OnMunicipalityBasisList?.OnMunicipalityBasis?.PeriodList?.Period?.reduce((accumulator: any, object: any) => {
                                return (accumulator + parseInt(object.TotalWorkforceHeadcount?._text) || 0)
                            }, 0) / WorkforceSection?.WorkforceInformationOnTerritorialBasis?.OnMunicipalityBasisList?.OnMunicipalityBasis?.PeriodList?.Period?.filter((period: any) => !isNaN(parseInt(period.TotalWorkforceHeadcount?._text))).length) || 0,
                        }
                    }
                },
                operativity: operativita,
                isOperativity: operativita.length && !(operativita.toLowerCase().includes('non')),
                contactPhoneNumber: investigationRecords.recapitiTelefonici,
                notePhoneNumber: noteTelefonici,
                companyShareholdings: companyShareholdingsPersonaGiuridica(HoldingsFromShareholders?.Holdings),
                negativity: {
                    protests: {
                        flag: convertObjectToArray(Protests?.ProtestsBlock)?.length > 0 ? true : false,
                        details: convertdescriptionProtest(Protests?.ProtestsBlock)
                    },
                    prejudicial: {
                        value: prejudicial.length ? true : false,
                        details: prejudicial
                    },
                    insolvencyProceedings: {
                        value: Bankruptcy?.BankruptcyBlock?.SubjectReport?._text || false,
                        details: convertdescriptionInsolvencyProceedings(Bankruptcy?.BankruptcyBlock?.SingleBankruptcyBlock)
                    }
                }
            },
        } as ICribisPersonaGiuridicaNoCorporate;

        if (campaign_kind_id === '684' || campaign_kind_id === '698' || campaign_kind_id === '714' || campaign_kind_id === '716' || campaign_kind_id === '769' || campaign_kind_id === '819') {
            result.company.attractiveMember = returnArrayOfAttractiveMembers(legalFormSubject) ? companyShareholdingsPersonaGiuridica(HoldingsFromShareholders?.Holdings) : [],
                result.company.vehicles = {
                    vehiclesPersona: veicoli,
                    vehiclesSocieta: veicoliLegalRappr
                },
                result.company.bankingRelationships = generateBankingRelationships(investigationRecords.contiCorrenti)
                const province = director?.Individual?.BirthPlace?._text;
            result.legallyResponsible = {
                registry: await getLegaleResponsabile(director,province,domicilio,isNoRea,investigation_record_id,pgConnection),
                availability: reperibilita,
                isReperibilita: isReperibilita,
                contactPhoneNumber: recapitiTelefoniciRappresentante,
                notePhoneNumber: noteTelefoniciRappresentante,
                positionsInCompany: await getCaricheInImprese(valuesPurchase?.PositionsInCompanies),
                workingActivity: attivitaLavorativa,
                companyShareholdings: companyShareholdingsPersonaFisica(valuesPurchase?.Shareholdings?.List?.Shareholding),
                negativity: {
                    protests: {
                        flag: +valuesPurchase?.ProtestsAndPrejudicialEvents?.Protests?.RecordNumber?._text > 0 ? true : false,
                        details: convertdescriptionProtestPersonaFisica(valuesPurchase?.ProtestsAndPrejudicialEvents?.Protests?.ValidEvents?.Event)
                    },
                    prejudicial: {
                        value: +valuesPurchase?.ProtestsAndPrejudicialEvents?.PrejudicialEvents?.RecordNumber?._text > 0 ? true : false,
                        prejudicials: convertPrejudicialPersonaFisica(valuesPurchase?.ProtestsAndPrejudicialEvents?.PrejudicialEvents),
                        details: convertDetailsPrejudicialPersonaFisica(valuesPurchase?.ProtestsAndPrejudicialEvents?.PrejudicialEvents)
                    },
                    insolvencyProceedings: false
                },
                vehicles: veicoli,
                bankingRelationships: rapportiBancari
            }
        }
        //Gestione per forma legale
        if (campaign_kind_id === '684') {
            result.company.buildings = await convertBuilding(codiceFiscale, true);
            result.company.recoverabilityJudgment = getRecoverabilityJudgment(result.company, 'PersonaGiuridica');
            if (director?.Individual?.TaxCode?._text.length) {
                result.legallyResponsible!.buildings = await convertBuilding(director?.Individual?.TaxCode?._text, true);
            }
            result.legallyResponsible!.recoverabilityJudgment = getRecoverabilityJudgment(result.legallyResponsible, 'PersonaFisica');
           
        } else if (campaign_kind_id === '698' || campaign_kind_id === '769' ) {
            result.company.negotiationInvestigations = investigationRecords.indaginiNegoziali;
            result.company.buildings = await convertBuilding(codiceFiscale, true);
            result.company.recoverabilityJudgment = getRecoverabilityJudgment(result.company, 'PersonaGiuridica');
            if (director?.Individual?.TaxCode?._text.length) {
                result.legallyResponsible!.buildings = await convertBuilding(director?.Individual?.TaxCode?._text, true);
            }
            result.legallyResponsible!.recoverabilityJudgment = getRecoverabilityJudgment(result.legallyResponsible, 'PersonaFisica');
        } else if (campaign_kind_id === '714'  || campaign_kind_id === '819')  {
            result.company.buildings = await convertBuilding(codiceFiscale, true);
             result.legallyResponsible!.bankingRelationships = convertBanking(relationshipLegal)
            if (director?.Individual?.TaxCode?._text.length) {
                result.legallyResponsible!.buildings = await convertBuilding(director?.Individual?.TaxCode?._text, true);                
            }
        } else if (campaign_kind_id === '694') {
            result.company.buildings = await convertBuilding(codiceFiscale, false);
            result.company.recoverabilityJudgment = getRecoverabilityJudgment(result.company, 'PersonaGiuridica');
            //Legale Rappresentante
            const responseLegallyResponsible = await findLegalRepresentative(OfficialDirectors?.Director[1]?.Individual?.TaxCode?._text, dateOfRequest, investigation_record_id)
            const valuesPurchaseLegalRepresentative = await valueFromResponsePurchase(responseLegallyResponsible?.json)
            if (valuesPurchaseLegalRepresentative === false) return false;
            result.company.availability = investigationRecords.residenze;
            result.company.mortgageInsights = approfondimentiIpotecari;
            result.company.availabilityLegalRepresentative = investigationRecords.residenze;
            result.company.positionsInCompanyLegalRepresentative = await getCaricheInImprese(valuesPurchaseLegalRepresentative?.PositionsInCompanies)
            result.company.legalHoldingsRepresentative = companyShareholdingsPersonaGiuridica(valuesPurchaseLegalRepresentative?.Shareholdings?.List?.Shareholding);
            result.company.relationshipLegal = relationshipLegal;
        }else if (campaign_kind_id === '716') {
            result.company.buildings = await convertBuilding(codiceFiscale, false);
            result.company.recoverabilityJudgment = getRecoverabilityJudgment(result.company, 'PersonaGiuridica');
            if (director?.Individual?.TaxCode?._text.length) {
                result.legallyResponsible!.buildings = await convertBuilding(director?.Individual?.TaxCode?._text, false);
            }
            result.company.esito = calculateEsito(prospectHistoryResponse?.CompanyReport?.Activity?.ActivityDescription?._text);
        }

        return result

    } catch (error) {
        console.error(error);
        await executionJob.error((error as CustomError).message);
        return false
    }

}

export function convertBanking(bankings : BankingRelationshipsLegalRepresentative[]) {

    let bankingRelationships : BankingRelationship[] = []

    bankings.forEach( banking => bankingRelationships.push({
        address: banking.address,
        businessName: banking.bankCompanyName,
        city: banking.commonAddress,
        piva: banking.bankVATNumber,
        abi: banking.abi,
        cab: banking.cab,
        toponimo: banking.toponymAddress,
        streetName: banking.streetAddress,
        streetNumber: banking.civicAddress,
        cap: banking.postalAddress,
        province: banking.provinceAddress,
        note: banking.notes
    }) )

    return bankingRelationships;
}

async function getLegaleResponsabile(director : any,province : any,domicilio : any,isNoRea : any,investigation_record_id : any,pgConnection : Sequelize){
    var formatted: any = '';
    if (director?.Individual?.BirthDate?._text != undefined && director?.Individual?.BirthDate?._text != null && director?.Individual?.BirthDate?._text != '' ) {
        const data:string = director?.Individual?.BirthDate?._text;
        const [year, month, day] = data.substring(0, 10).split('-');
        formatted = `${day}/${month}/${year}`;
    }
    var strToponimo = domicilio?.toponimo || '';
    return isNoRea ? await getLegaleRappresentante(investigation_record_id,domicilio,pgConnection) : {
        surname: director?.Individual?.LastName?._text,
        name: director?.Individual?.FirstName?._text,
        cf: director?.Individual?.TaxCode?._text,
        dateOfBirth: formatted,
        placeOfBirth: province?.length ? province.substring(0,province.length-4): '',
        provinceOfBirth: province?.length ? province.substring(province.length-3,province.length-1) : '',
        address: director?.Individual?.ResidenceAddress?.Street?._text,
        cap: director?.Individual?.ResidenceAddress?.PostCode?._text,
        municipality: director?.Individual?.ResidenceAddress?.Municipality?._text,
        province: director?.Individual?.ResidenceAddress?.Province?._attributes?.Code,
        livingAddress: director?.Individual?.ResidenceAddress?.Street?._text ? director?.Individual?.ResidenceAddress?.Street?._text : `${strToponimo} ${domicilio?.via} ${domicilio?.civico}`,
        livingCap:  director?.Individual?.ResidenceAddress?.PostCode?._text ?  director?.Individual?.ResidenceAddress?.PostCode?._text : domicilio?.cap,
        livingMunicipality: director?.Individual?.ResidenceAddress?.Municipality?._text ? director?.Individual?.ResidenceAddress?.Municipality?._text : domicilio?.comune,
        livingProvince: director?.Individual?.ResidenceAddress?.Province?._attributes?.Code ? director?.Individual?.ResidenceAddress?.Province?._attributes?.Code : domicilio?.provincia
    }
}