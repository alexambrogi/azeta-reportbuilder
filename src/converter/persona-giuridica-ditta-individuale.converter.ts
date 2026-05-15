import moment from "moment"
import { getNoteTelefoniciRappresentante, getNoteTelefonici, CustomError, companyShareholdingsPersonaFisica, convertBuilding, convertDetailsPrejudicialPersonaFisicaDittaIndividuale, convertObjectToArray, convertPrejudicialPersonaFisicaDittaIndividuale, convertdescriptionInsolvencyProceedings, convertdescriptionProtest, convertdescriptionProtestPersonaFisica, findLegalRepresentative, generateBankingRelationships, getAttivitaLavorativa, getBankingRelationshipsLegalRepresentative, getCaricheInImprese, getInvestigationRecordsBySubjectLegalForm, getLegaleRappresentante, getAnagraficaPersonaFisica, getOperativitaSocieta, getPrejudical, getRecoverabilityJudgment, getReperibilita, getVeicoli, getVeicoliLegalRappr, valueFromResponsePurchase,getRecapitiTelefoniciRappresentante } from "../utils"
import { ICribisPersonaGiuridica, InvestigationRecords } from "../models/persona-giuridica.model"
import { Sequelize } from "sequelize"
import { InputDataCustomer } from "../models/sftp.model"
import { ExecutionJob } from "../models/logger.model"
import { getInformazione } from "./money-plus-persona-giuridica.converter"
import { CodiciFiscaliAndCustomCode } from "../models/ciro.model"
import { getAnagraficaImpresaGiuridica } from "./persona-giuridica.converter"

export const personaGiuridicaDittaIndividualeConverter = async (
    pgConnection: Sequelize,
    investigation_record_id: string,
    dateOfRequest: string,
    campaign_kind_id: string,
    executionJob : ExecutionJob,
    codiceFiscale : string,
    codiciFiscaliAndCustomCode:CodiciFiscaliAndCustomCode[],
    customerInput?: InputDataCustomer,
    productPurchaseResponse?: { [key: string]: any },
    prospectHistoryResponse?: { [key: string]: any },
    isNoRea? : any
): Promise<ICribisPersonaGiuridica | false> => {
    const {
        CompanyActivitySection,
        WorkforceSection
    } = prospectHistoryResponse?.COCCompanyReport || {};
    const {
        ItemInformation,
        Activity,
        Bankruptcy,
        OfficialDirectors,
        Protests,
        AgreedWindingUpProcedures
    } = productPurchaseResponse?.CompanyReport || {};

    const investigationRecords: InvestigationRecords | false = await getInvestigationRecordsBySubjectLegalForm(pgConnection, investigation_record_id)
    if(investigationRecords === false) return false;

    const veicoli = await getVeicoli(investigation_record_id, pgConnection)
    if (veicoli === false) return false

    const veicoliLegalRappr = await getVeicoliLegalRappr(investigation_record_id, pgConnection)
    if (veicoliLegalRappr === false) return false

    const relationshipLegal = await getBankingRelationshipsLegalRepresentative(investigation_record_id, pgConnection)
    if (relationshipLegal === false) return false

    const prejudicial = await getPrejudical(investigation_record_id, pgConnection)
    if(prejudicial === false) return false

    const operativita = await getOperativitaSocieta(investigation_record_id, pgConnection)
    if(operativita === false) return false

    const recapitiTelefoniciRappresentante = await getRecapitiTelefoniciRappresentante(investigation_record_id, pgConnection);
    if (recapitiTelefoniciRappresentante === false) return false

    const noteTelefoniciRappresentante = await getNoteTelefoniciRappresentante(investigation_record_id, pgConnection)
    if (noteTelefoniciRappresentante === false) return false

    const noteTelefonici = await getNoteTelefonici(investigation_record_id, pgConnection)
    if (noteTelefonici === false) return false


    const birthPlace = OfficialDirectors?.Director?.Individual?.BirthPlace?._text ?
        `${OfficialDirectors?.Director?.Individual?.BirthPlace?._text || ''} ${OfficialDirectors?.Director?.Individual?.BirthCountry?._text || ''} ${OfficialDirectors?.Director?.Individual?.BirthCountry?._attributes?.Code ? `(${OfficialDirectors?.Director?.Individual?.BirthCountry?._attributes?.Code})` : ''}`
        : '';

    const birthDate = OfficialDirectors?.Director?.Individual?.BirthDate?._text ?
        `il ${moment(new Date(OfficialDirectors?.Director?.Individual?.BirthDate?._attributes?.year, (OfficialDirectors?.Director?.Individual?.BirthDate?._attributes?.month - 1), OfficialDirectors?.Director?.Individual?.BirthDate?._attributes?.day)).format("DD/MM/YYYY")}`
        : '';

    const anagrafica = await getAnagraficaPersonaFisica(investigation_record_id, pgConnection)

        try {
            let {reperibilita,isReperibilita} = (await getReperibilita(investigation_record_id, pgConnection, !anagrafica ? undefined : anagrafica ));
            if(reperibilita === null) reperibilita = []
            const result = {
                informazioneN : getInformazione(codiciFiscaliAndCustomCode,codiceFiscale),
                campaign_kind_id,
                inputData: {
                    dateOfRequest,
                    releaseDate: moment(new Date()).format("DD/MM/YYYY"),
                    numberInformation: '',
                    refCustomer: customerInput?.refCustomer || ''
                },
                registry: getAnagraficaImpresaGiuridica(ItemInformation,CompanyActivitySection,Activity,null,isNoRea),
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
                contactPhoneNumber: investigationRecords.recapitiTelefonici,
                notePhoneNumber: noteTelefonici,
                bankingRelationships: generateBankingRelationships(investigationRecords.contiCorrenti),
                operativity: operativita,
                isOperativity: operativita.length && !(operativita.toLowerCase().includes('non')),
                vehicles: {
                    vehiclesPersona: veicoli,
                    vehiclesSocieta: veicoliLegalRappr
                },
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
                        value: Bankruptcy?.BankruptcyBlock?.SubjectReport?._text === 'true' ? true : false,
                        details: convertdescriptionInsolvencyProceedings(Bankruptcy?.BankruptcyBlock?.SingleBankruptcyBlock)
                    }
                },
                availability: reperibilita,
                isReperibilita: isReperibilita,
                registryOwner: {
                    name: `${OfficialDirectors?.Director?.Individual?.LastName?._text || ''} ${OfficialDirectors?.Director?.Individual?.FirstName?._text || ''}`,
                    taxCode: OfficialDirectors?.Director?.Individual?.TaxCode?._text || '',
                    birth: `${birthPlace} ${birthDate}`,
                    residence: investigationRecords.residenze,
                    domicile: await getReperibilita(investigation_record_id, pgConnection)
                },
                workingActivity: await getAttivitaLavorativa(investigation_record_id, pgConnection, ItemInformation?.CompanyInformation?.CompanyName?._text),
                furtherInformation: {
                    numberOfOfficeHolders: '1'
                },
                legallyResponsible: {
                    contactPhoneNumber: recapitiTelefoniciRappresentante,
                    notePhonNumber: noteTelefoniciRappresentante,
                }                
            } as ICribisPersonaGiuridica;
        
            if(isNoRea){
                const legale = await getLegaleRappresentante(investigation_record_id,null,pgConnection);
                result.registryOwner.name = `${legale.name}  ${legale.surname}`;
                result.registryOwner.taxCode = legale.cf;
                result.registryOwner.birth = legale.dateOfBirth;
            }
            //EFFETTUARE LA CHIAMATA DI PERSONA FISICA CON IL CODICE FISCALE DEL TITOLARE
            if (OfficialDirectors?.Director?.Individual?.TaxCode?._text) {
                //Legale Rappresentante
                const responsePersonaFisica = await findLegalRepresentative(OfficialDirectors?.Director?.Individual?.TaxCode?._text, dateOfRequest, investigation_record_id)
                const valuesPurchase = await valueFromResponsePurchase(responsePersonaFisica?.json)
                if(valuesPurchase === false) return false
        
                //Dalla sua response devo ottenere i dati da elaborare nelle sezioni sottostanti
                result.positionsInCompany = await getCaricheInImprese(valuesPurchase?.PositionsInCompanies);
                result.companyShareholdings = companyShareholdingsPersonaFisica(valuesPurchase?.Shareholdings?.List?.Shareholding);
                result.negativityOwner = {
                    protests: {
                        flag: +valuesPurchase?.ProtestsAndPrejudicialEvents?.Protests?.RecordNumber?._text > 0 ? true : false,
                        details: convertdescriptionProtestPersonaFisica(valuesPurchase?.ProtestsAndPrejudicialEvents?.Protests?.ValidEvents?.Event)
                    },
                    prejudicial: {
                        value: +valuesPurchase?.ProtestsAndPrejudicialEvents?.PrejudicialEvents?.RecordNumber?._text > 0 ? true : false,
                        prejudicials: convertPrejudicialPersonaFisicaDittaIndividuale(valuesPurchase?.ProtestsAndPrejudicialEvents?.PrejudicialEvents),
                        details: convertDetailsPrejudicialPersonaFisicaDittaIndividuale(valuesPurchase?.ProtestsAndPrejudicialEvents?.PrejudicialEvents)
                    },
                    insolvencyProceedings: false
                };
                result.relationshipLegal = relationshipLegal;
            }
            if (campaign_kind_id === '684' || campaign_kind_id === '698' || campaign_kind_id === '714'|| campaign_kind_id === '819') {
                if (ItemInformation?.CompanyInformation?.TaxCode?._text?.length) {
                    result.buildings = await convertBuilding(ItemInformation?.CompanyInformation?.TaxCode?._text, true);
                }
            }
            if (campaign_kind_id === '684' || campaign_kind_id === '698') {
                result.recoverabilityJudgment = getRecoverabilityJudgment(result, 'PersonaGiuridica')
            } 
            if (campaign_kind_id === '698' || campaign_kind_id === '769') {
                result.negotiationInvestigations = investigationRecords.indaginiNegoziali;
            }
            if (campaign_kind_id === '801'){
                result.negativityOwner = {
                    protests:{flag : false},
                    prejudicial: {value : false,prejudicials : []},
                    insolvencyProceedings :false
                }
            }
            result.isNoRea = isNoRea ? false : true
            return result
            
        } catch (error) {
            console.error(error);
            await executionJob.error((error as CustomError).message);
            return false
        }
}