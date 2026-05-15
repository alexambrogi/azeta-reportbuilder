import moment from "moment"
import { ICribisPersonaGiuridica, InvestigationRecords } from "../models/persona-giuridica.model"
import { CustomError, generateBankingRelationships, getInvestigationRecordsBySubjectLegalForm, returnArrayOfShareholdersList } from "../utils"
import { Sequelize } from "sequelize"
import { InputDataCustomer } from "../models/sftp.model"
import { ExecutionJob } from "../models/logger.model"
import { getInformazione } from "./money-plus-persona-giuridica.converter"
import { CodiciFiscaliAndCustomCode } from "../models/ciro.model"

export const moneyLightPersonaGiuridicaConverter = async (
    pgConnection: Sequelize,
    investigation_record_id: string,
    dateOfRequest: string,
    campaign_kind_id: string,
    executionJob : ExecutionJob,
    codiciFiscaliAndCustomCode:CodiciFiscaliAndCustomCode[],
    codiceFiscale:string,
    customerInput?: InputDataCustomer,
    productPurchaseResponse?: { [key: string]: any },
    prospectHistoryResponse?: { [key: string]: any },
): Promise<ICribisPersonaGiuridica | false> => {
    const {
        ItemInformation,
        Activity,
        Shareholders,
    } = productPurchaseResponse?.CompanyReport || {};
    const {
        CompanyActivitySection,
        InformationOnIncorporationSection,
        WorkforceSection,
        CorporateGovernanceAndDirectorsSection
    } = prospectHistoryResponse?.COCCompanyReport || {};

    const responseCompanyData = prospectHistoryResponse?.COCCompanyReport?.CompanyIdentificationSection || ''
    const investigationRecords: InvestigationRecords | false = await getInvestigationRecordsBySubjectLegalForm(pgConnection, investigation_record_id);
    if(investigationRecords === false) return false

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
                registry: {
                    businessName: ItemInformation?.CompanyInformation?.CompanyName?._text || '',
                    taxCode: ItemInformation?.CompanyInformation?.TaxCode?._text || '',
                    iva: ItemInformation?.CompanyInformation?.VATRegistrationNo?._text || '',
                    codeREA: ItemInformation?.ReaCode?.CoCProvinceCode?._text + ItemInformation?.ReaCode?.REANo?._text || '',
                    site: `${ItemInformation?.CompanyInformation?.Address?.Street?._text} - ${ItemInformation?.CompanyInformation?.Address?.PostCode?._text} ${ItemInformation?.CompanyInformation?.Address?.Municipality?._text} (${ItemInformation?.CompanyInformation?.Address?.Province?._attributes?.Code})`,
                    legalForm: ItemInformation?.CompanyInformation?.CompanyForm?._text || '',
                    stateOfCompany: ItemInformation?.ActivityStatusDescription?._text || '',
                    startCompanyDate: ItemInformation?.ActivityStartDate?._attributes?.year ? moment(new Date(ItemInformation?.ActivityStartDate?._attributes?.year, (ItemInformation?.ActivityStartDate?._attributes?.month - 1), ItemInformation?.ActivityStartDate?._attributes?.day)).format("DD/MM/YYYY") : '',
                    activity: `${CompanyActivitySection?.CompanyActivityList?.BusinessActivity[0]?.Code?._text ? `${CompanyActivitySection?.CompanyActivityList?.BusinessActivity[0]?.Code?._text} - ` : ''}${Activity?.ActivityDescription?._text || ''}`,
                    raeCode: ItemInformation?.RaeCode?._text || '',
                    saeCode: ItemInformation?.SaeCode?._text || '',
                    certifiedEmail: ItemInformation?.CertifiedEmail?._text || '',
                    dateIncorporation: `${ItemInformation?.IncorporationDate?._attributes?.day || ''}/${ItemInformation?.IncorporationDate?._attributes?.month || ''}/${ItemInformation?.IncorporationDate?._attributes?.year || ''}`,
                    socialCapital: new Intl.NumberFormat('de-DE').format(ItemInformation?.AuthorizedEquityCapital?._text || 0) || '',
                    naceCode: ItemInformation?.NaceCode?._text || '',
                    expectedEndDate: InformationOnIncorporationSection?.ActualData?.MemorandumAssociation?.ExpectedEndDate?.Value?._text || ''
                },
                companyData: {
                    codiceFiscale: responseCompanyData?.TaxCode?._text || '',
                    cciaaNrea: `${responseCompanyData?.REAProvinceCode?._text} ${responseCompanyData?.REANumber?._text}` || '',
                    denominazione: responseCompanyData?.CompanyName?._text || '',
                    indirizzo: `${responseCompanyData?.RHOAddress?.ToponymCode?._attributes?.description} ${responseCompanyData?.RHOAddress?.StreetName?._text} ${responseCompanyData?.RHOAddress?.StreetNo?._text} CAP ${responseCompanyData?.RHOAddress?.PostCode?._text} ${responseCompanyData?.RHOAddress?.City?._text} (${responseCompanyData?.RHOAddress?.ProvinceCode?._text})` || '',
                    telefono: responseCompanyData?.RHOPhone?.TelNo?._text ? `081/${responseCompanyData?.RHOPhone?.TelNo?._text }` : '',
                    fax: responseCompanyData?.RHOPhone?.FaxNo?._text ? `081/${responseCompanyData?.RHOPhone?.FaxNo?._text}` : '',
                    emailCertificata: responseCompanyData?.CertifiedEmail?._text || '',
                    attivita: responseCompanyData?.RHOSlimActivityList?.SlimBusinessActivity[0]?.Code?._attributes?.description || ''
                },
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
                members: returnArrayOfShareholdersList(Shareholders?.ShareholdersList), //Soci
                administration: {
                    form: CorporateGovernanceAndDirectorsSection?.CorporateGovernance?._attributes?.description || '',
                    systemOfAdministration: CorporateGovernanceAndDirectorsSection?.CorporateGovernance?._attributes?.description || '',
                    administrationForm: CorporateGovernanceAndDirectorsSection?.CorporateGovernanceFormList?.CorporateGovernanceAndSupervisionForm?.FormCode?._attributes?.description || '',
                    numberOfAdministration: CorporateGovernanceAndDirectorsSection?.CorporateGovernanceFormList?.CorporateGovernanceAndSupervisionForm?.NumberOfDirectorsInOffice?._text || ''
                },
                bankingRelationships: generateBankingRelationships(investigationRecords.contiCorrenti)
            } as ICribisPersonaGiuridica;
        
            return result

    }catch(error){
        console.error(error);
        await executionJob.error((error as CustomError).message);
        return false
    }
}