import CodiceFiscale from "codice-fiscale-js"
import moment from "moment"
import { Sequelize } from "sequelize"
import { ExecutionJob } from "../models/logger.model"
import { ICribisPersonaGiuridica, InvestigationRecords } from "../models/persona-giuridica.model"
import { InputDataCustomer } from "../models/sftp.model"
import { getNoteTelefoniciRappresentante, getNoteTelefonici, CustomError, companyShareholdingsPersonaGiuridica, convertBuilding, convertObjectToArray, convertdescriptionInsolvencyProceedings, getRecapitiTelefoniciRappresentante, convertdescriptionPrejudicial, convertdescriptionProtest, findLegalRepresentative, generateBalance, generateBankingRelationships, getAnagraficaPersonaFisica, getApprofondimentiIpotecari, getBankingRelationshipsLegalRepresentative, getCaricheInImprese, getInvestigationRecordsBySubjectLegalForm, getOperativitaSocieta, getPrejudical, getRecoverabilityJudgment, getVeicoli, getVeicoliLegalRappr, returnArrayOfAttractiveMembers, returnArrayOfShareholdersList, valueFromResponsePurchase } from "../utils"
import { getInformazione } from "./money-plus-persona-giuridica.converter"
import { CodiciFiscaliAndCustomCode } from "../models/ciro.model"

export const personaGiuridicaConverter = async (
    pgConnection: Sequelize,
    investigation_record_id: string,
    codiceFiscale: string,
    dateOfRequest: string,
    campaign_kind_id: string,
    executionJob: ExecutionJob,
    codiciFiscaliAndCustomCode: CodiciFiscaliAndCustomCode[],
    customerInput?: InputDataCustomer,
    productPurchaseResponse?: { [key: string]: any },
    prospectHistoryResponse?: { [key: string]: any },
    investigated_subject_id?: string,
    isNoRea?: boolean
): Promise<ICribisPersonaGiuridica | false> => {
    const {
        ItemInformation,
        Activity,
        CompanyEmployee,
        BalanceSheetCebi,
        Shareholders,
        HoldingsFromShareholders,
        Bankruptcy,
        Protests,
        OfficialDirectors
    } = productPurchaseResponse?.CompanyReport || {};
    const {
        CompanyActivitySection,
        InformationOnIncorporationSection,
        WorkforceSection,
        CorporateGovernanceAndDirectorsSection,
        BranchListSection
    } = prospectHistoryResponse?.COCCompanyReport || {};

    const responseCompanyData = prospectHistoryResponse?.COCCompanyReport?.CompanyIdentificationSection || ''
    const legalFormSubject = ItemInformation?.CompanyInformation?.CompanyForm?._attributes?.LegalFormDescription || '';

    const investigationRecords: InvestigationRecords | false = await getInvestigationRecordsBySubjectLegalForm(pgConnection, investigation_record_id);
    if (investigationRecords === false) return false
    const recapitiTelefoniciRappresentante = await getRecapitiTelefoniciRappresentante(investigation_record_id, pgConnection);
    if (recapitiTelefoniciRappresentante === false) return false

    const noteTelefoniciRappresentante = await getNoteTelefoniciRappresentante(investigation_record_id, pgConnection)
    if (noteTelefoniciRappresentante === false) return false
    const noteTelefonici = await getNoteTelefonici(investigation_record_id, pgConnection)
    if (noteTelefonici === false) return false
        

    const anagraficaRappresentante = await getAnagraficaPersonaFisica(investigation_record_id, pgConnection);
    if (anagraficaRappresentante === false) return false

    const veicoli = await getVeicoli(investigation_record_id, pgConnection)
    if (veicoli === false) return false

    const veicoliLegalRappr = await getVeicoliLegalRappr(investigation_record_id, pgConnection)
    if (veicoliLegalRappr === false) return false

    //const negativities = convertObjectToArray(productPurchaseResponse?.CompanyReport?.AgreedWindingUpProcedures?.ItemAgreeWindingUpProcedure?.AgreedWindingUpProcedure);

    const relationshipLegal = await getBankingRelationshipsLegalRepresentative(investigation_record_id, pgConnection)
    if (relationshipLegal === false) return false

    let prejudicial = await getPrejudical(investigation_record_id, pgConnection)
    if (prejudicial === false) return false

    if (campaign_kind_id === '698' || prejudicial.length === 0) {
        prejudicial = convertdescriptionPrejudicial(convertObjectToArray(productPurchaseResponse?.CompanyReport?.AgreedWindingUpProcedures?.ItemAgreeWindingUpProcedure?.AgreedWindingUpProcedure))
    }

    const approfondimentiIpotecari = await getApprofondimentiIpotecari(investigation_record_id, pgConnection)
    if (approfondimentiIpotecari === false) return false

    // const approfondimentiIpotecariLegale = await getApprofondimentiIpotecariRapprLegale(investigation_record_id, pgConnection)
    // if(approfondimentiIpotecariLegale === false) return false

    const operativita = await getOperativitaSocieta(investigation_record_id, pgConnection)
    if (operativita === false) return false

    try {
        const result = {
            informazioneN: getInformazione(codiciFiscaliAndCustomCode, codiceFiscale),
            campaign_kind_id,
            inputData: {
                dateOfRequest,
                releaseDate: moment(new Date()).format("DD/MM/YYYY"),
                numberInformation: '',
                refCustomer: customerInput?.refCustomer || ''
            },
            registry: getAnagraficaImpresaGiuridica(ItemInformation, CompanyActivitySection, Activity, InformationOnIncorporationSection, isNoRea),
            companyData: {
                codiceFiscale: responseCompanyData?.TaxCode?._text || '',
                cciaaNrea: `${responseCompanyData?.REAProvinceCode?._text} ${responseCompanyData?.REANumber?._text}` || '',
                denominazione: responseCompanyData?.CompanyName?._text || '',
                indirizzo: `${responseCompanyData?.RHOAddress?.ToponymCode?._attributes?.description} ${responseCompanyData?.RHOAddress?.StreetName?._text} ${responseCompanyData?.RHOAddress?.StreetNo?._text} CAP ${responseCompanyData?.RHOAddress?.PostCode?._text} ${responseCompanyData?.RHOAddress?.City?._text} (${responseCompanyData?.RHOAddress?.ProvinceCode?._text})` || '',
                telefono: responseCompanyData?.RHOPhone?.TelNo?._text ? `081/${responseCompanyData?.RHOPhone?.TelNo?._text}` : '',
                fax: responseCompanyData?.RHOPhone?.FaxNo?._text ? `081/${responseCompanyData?.RHOPhone?.FaxNo?._text}` : '',
                emailCertificata: responseCompanyData?.CertifiedEmail?._text || '',
                attivita: responseCompanyData?.RHOSlimActivityList?.SlimBusinessActivity?.Code?._attributes?.description || responseCompanyData?.RHOSlimActivityList?.SlimBusinessActivity[0]?.Code?._attributes?.description || ''
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
                },
                secondaryAddress: getSecondary(BranchListSection)
            },
            balance: generateBalance(BalanceSheetCebi?.BalanceSheetInfo, CompanyEmployee),
            members: returnArrayOfShareholdersList(Shareholders?.ShareholdersList), //Soci
            administration: {
                form: CorporateGovernanceAndDirectorsSection?.CorporateGovernance?._attributes?.description || '',
                systemOfAdministration: CorporateGovernanceAndDirectorsSection?.CorporateGovernance?._attributes?.description || '',
                administrationForm: CorporateGovernanceAndDirectorsSection?.CorporateGovernanceFormList?.CorporateGovernanceAndSupervisionForm?.FormCode?._attributes?.description || '',
                numberOfAdministration: CorporateGovernanceAndDirectorsSection?.CorporateGovernanceFormList?.CorporateGovernanceAndSupervisionForm?.NumberOfDirectorsInOffice?._text || ''
            },
            contactPhoneNumber: investigationRecords.recapitiTelefonici,
            notePhoneNumber: noteTelefonici,
            operativity: operativita,
            isOperativity: operativita.length && !(operativita.toLowerCase().includes('non')),
            negativity: getNegativityGiuridica(Protests, prejudicial, Bankruptcy),
        } as ICribisPersonaGiuridica;


        if (campaign_kind_id === '684' || campaign_kind_id === '698' || campaign_kind_id === '714' || campaign_kind_id === '819') {
            result.bankingRelationships = generateBankingRelationships(investigationRecords.contiCorrenti);
            result.vehicles = {
                vehiclesPersona: veicoli,
                vehiclesSocieta: veicoliLegalRappr
            };
            result.attractiveMember = returnArrayOfAttractiveMembers(legalFormSubject) ? companyShareholdingsPersonaGiuridica(HoldingsFromShareholders?.Holdings) : [];
            result.companyShareholdings = companyShareholdingsPersonaGiuridica(HoldingsFromShareholders?.Holdings);
        }
        if (campaign_kind_id === '684' ) {
            result.buildings = await convertBuilding(codiceFiscale, true);
            result.recoverabilityJudgment = getRecoverabilityJudgment(result, 'PersonaGiuridica');
        } else if (campaign_kind_id === '698' || campaign_kind_id === '769') {
            result.negotiationInvestigations = investigationRecords.indaginiNegoziali;
            result.buildings = await convertBuilding(codiceFiscale, true);
            result.recoverabilityJudgment = getRecoverabilityJudgment(result, 'PersonaGiuridica');
        } else if (campaign_kind_id === '714') {
            result.buildings = await convertBuilding(codiceFiscale, true);
        } else if (campaign_kind_id === '694'  || campaign_kind_id === '819') {
            
            var estimate = campaign_kind_id === '819' ? true : false;
            result.buildings = await convertBuilding(codiceFiscale, estimate);
            
            result.companyShareholdings = companyShareholdingsPersonaGiuridica(HoldingsFromShareholders?.Holdings);
            result.availability = investigationRecords.residenze;
            result.mortgageInsights = approfondimentiIpotecari;
            result.availabilityLegalRepresentative = investigationRecords.residenze;
            result.domicile = investigationRecords.domicilio
            result.legalRapresentativeInfo = anagraficaRappresentante;
            result.recoverabilityJudgment = getRecoverabilityJudgment(result, 'PersonaGiuridica');
            //Legale Rappresentante
            if (campaign_kind_id === '694') {
                const responsePersonaFisica = await findLegalRepresentative(OfficialDirectors?.Director[1]?.Individual?.TaxCode?._text, dateOfRequest, investigation_record_id)
                const valuesPurchaseLegalRepresentative = await valueFromResponsePurchase(responsePersonaFisica?.json)
                if (valuesPurchaseLegalRepresentative === false) return false;
                result.legalRapresentativePersonalData = getLegaleRappresentantePersonalData(responsePersonaFisica);
                result.positionsInCompanyLegalRepresentative = await getCaricheInImprese(valuesPurchaseLegalRepresentative?.PositionsInCompanies)
                result.legalHoldingsRepresentative = companyShareholdingsPersonaGiuridica(valuesPurchaseLegalRepresentative?.Shareholdings?.List?.Shareholding);
            } else {
                result.legalRapresentativePersonalData = getLegaleRappresentantePersonalData819(OfficialDirectors?.Director.Individual);
            }
            if (recapitiTelefoniciRappresentante.length) {
                result.legalRapresentativePersonalData.contactPhoneNumber = recapitiTelefoniciRappresentante;
                result.legalRapresentativePersonalData.notePhoneNumber = noteTelefoniciRappresentante;
            }
            try {
                anagraficaRappresentante.placeOfBirth = extractPlaceOfBirth(anagraficaRappresentante.placeOfBirth, result.legalRapresentativePersonalData.taxIdCode) || '';
                anagraficaRappresentante.provinceOfBirth = extractProvinceOfBirth(anagraficaRappresentante.provinceOfBirth, result.legalRapresentativePersonalData.taxIdCode) || '';
                anagraficaRappresentante.dateOfBirth = extractBirthDay(anagraficaRappresentante.dateOfBirth, result.legalRapresentativePersonalData.taxIdCode) || ''
            } catch (error) {
                console.error(error, result.legalRapresentativePersonalData.taxIdCode)
            }
            result.relationshipLegal = relationshipLegal;
        } else if (campaign_kind_id === '704' || campaign_kind_id === '875') {
            result.vehicles = {
                vehiclesPersona: veicoli,
                vehiclesSocieta: veicoliLegalRappr
            };
            result.buildings = await convertBuilding(codiceFiscale, true);
            result.attractiveMember = returnArrayOfAttractiveMembers(legalFormSubject) ? companyShareholdingsPersonaGiuridica(HoldingsFromShareholders?.Holdings) : [];
            result.companyShareholdings = companyShareholdingsPersonaGiuridica(HoldingsFromShareholders?.Holdings);
            result.bankingRelationships = generateBankingRelationships(investigationRecords.contiCorrenti);
        } else if (campaign_kind_id === '716') {
            result.buildings = await convertBuilding(codiceFiscale, false);
            result.recoverabilityJudgment = getRecoverabilityJudgment(result, 'PersonaGiuridica');
            result.esito = calculateEsito(prospectHistoryResponse?.CompanyReport?.Activity?.ActivityDescription?._text);
        }
        return result

    } catch (error) {
        console.error(error);
        await executionJob.error((error as CustomError).message);
        return false

    }

}

export function getNegativityGiuridica(Protests: any, prejudicial: any, Bankruptcy: any) {
    return {
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
}

export function getAnagraficaImpresaGiuridica(ItemInformation: any, CompanyActivitySection: any, Activity: any, InformationOnIncorporationSection: any, isNoRea: any) {
    return isNoRea ? isNoRea :
        {
            businessName: ItemInformation?.CompanyInformation?.CompanyName?._text || '',
            taxCode: ItemInformation?.CompanyInformation?.TaxCode?._text || '',
            iva: ItemInformation?.CompanyInformation?.VATRegistrationNo?._text || '',
            codeREA: ItemInformation?.ReaCode?.CoCProvinceCode?._text + ItemInformation?.ReaCode?.REANo?._text || '',
            site: `${ItemInformation?.CompanyInformation?.Address?.Street?._text || ''} - ${ItemInformation?.CompanyInformation?.Address?.PostCode?._text || ''} ${ItemInformation?.CompanyInformation?.Address?.Municipality?._text || ''} (${ItemInformation?.CompanyInformation?.Address?.Province?._attributes?.Code || ''})`,
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
        }

}

export function extractProvinceOfBirth(provinceOfBirth: string | null, cf: any) {
    console.log("sono nella generazione provinceOfBirth con codice fiscale", cf)
    if (provinceOfBirth === null || provinceOfBirth === '') {
        try {
            return new CodiceFiscale(cf).birthplace.prov;
        } catch (exce) {
            return provinceOfBirth;
        }
    }
    return provinceOfBirth;
}

export function extractPlaceOfBirth(placeOfBirth: string | null, cf: any) {
    console.log("sono nella generazione placeOfBirth con codice fiscale", cf)
    if (placeOfBirth === null || placeOfBirth === '') {
        try {
            return new CodiceFiscale(cf).birthplace.nome;
        } catch (exce) {
            return placeOfBirth;
        }
    }
    return placeOfBirth;
}

export function extractBirthDay(birthday: string | null, cf: any) {
    console.log("sono nella generazione placeOfBirth con codice fiscale", cf)
    try {
        if (birthday === null || birthday === '') {
            return moment(new CodiceFiscale(cf).birthday).format('DD-MM-YYYY');
        }
    } catch (exce) {
        return birthday;
    }
    return birthday;
}

function getSecondary(BranchListSection: any): { secondaryRoute?: string; secondaryStreet?: string; secondaryStreetNo?: string; secondaryCity?: string; secondaryPostCode?: string; secondaryProvinceCode?: string } | undefined {
    return {
        secondaryRoute: BranchListSection?.BranchList?.Branch?.Location?.Address?.ToponymCode?._text,
        secondaryStreet: BranchListSection?.BranchList?.Branch?.Location?.Address?.StreetName?._text,
        secondaryStreetNo: BranchListSection?.BranchList?.Branch?.Location?.Address?.StreetNo?._text,
        secondaryCity: BranchListSection?.BranchList?.Branch?.Location?.Address?.City?._text,
        secondaryPostCode: BranchListSection?.BranchList?.Branch?.Location?.Address?.PostCode?._text,
        secondaryProvinceCode: BranchListSection?.BranchList?.Branch?.Location?.Address?.ProvinceCode?._text,
    }
}
export function calculateEsito(attivo: any): any {
    if (attivo && attivo.toLocaleLowerCase() === 'attiva')
        return true;
    else
        return false;

}

export function getLegaleRappresentantePersonalData(responsePersonaFisica: any): any {
    return {
        firstName: responsePersonaFisica?.json?.CheckImprenditore?.Dossier?.DocumentHeader?.FirstName?._text || "",
        lastName: responsePersonaFisica?.json?.CheckImprenditore?.Dossier?.DocumentHeader?.LastName?._text || "",
        taxIdCode: responsePersonaFisica?.json?.CheckImprenditore?.Dossier?.PersonalData?.IdentificationData?.FoundIdentifications?.Identification[0]?.TaxCode?._text || "",
        placeOfBirth : extractPlaceOfBirth(null, responsePersonaFisica?.json?.CheckImprenditore?.Dossier?.PersonalData?.IdentificationData?.FoundIdentifications?.Identification[0]?.TaxCode?._text),
        provinceOfBirth : extractProvinceOfBirth(null, responsePersonaFisica?.json?.CheckImprenditore?.Dossier?.PersonalData?.IdentificationData?.FoundIdentifications?.Identification[0]?.TaxCode?._text),
        dateOfBirth : extractBirthDay(null, responsePersonaFisica?.json?.CheckImprenditore?.Dossier?.PersonalData?.IdentificationData?.FoundIdentifications?.Identification[0]?.TaxCode?._text),
            
    }
}

export function getLegaleRappresentantePersonalData819(responsePersonaFisica: any): any {
    return {
        firstName: responsePersonaFisica?.FirstName?._text || "",
        lastName: responsePersonaFisica?.LastName?._text || "",
        taxIdCode: responsePersonaFisica?.TaxCode?._text || "",
        placeOfBirth : extractPlaceOfBirth(null, responsePersonaFisica?.TaxCode?._text),
        provinceOfBirth : extractProvinceOfBirth(null, responsePersonaFisica?.TaxCode?._text),
        dateOfBirth : extractBirthDay(null, responsePersonaFisica?.TaxCode?._text),
           
    }
}

