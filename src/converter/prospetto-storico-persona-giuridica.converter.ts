import { CodiciFiscaliAndCustomCode } from "../models/ciro.model";
import { ICribisProspettoStorico } from "../models/prospetto-storico.model";
import { convertObjectToArray, generateBalance } from "../utils";
import { getInformazione } from "./money-plus-persona-giuridica.converter";


export const prospettoStoricoConverter = async (
    codiceFiscale : string,
    codiciFiscaliAndCustomCode:CodiciFiscaliAndCustomCode[],
    productPurchaseResponse?: { [key: string]: any },
    prospectHistoryResponse?: { [key: string]: any },
    haveBilance?: any
): Promise<ICribisProspettoStorico> => {
    const {
        Shareholders,
        ItemInformation,
        DeliveryAndSummaryDetails,
        CompanyEmployee,
        BalanceSheetCebi,
        LastTwelveMonthRequests
    } = productPurchaseResponse?.CompanyReport || {};
    const {
        CompanyActivitySection,
        InformationOnIncorporationSection,
        WorkforceSection,
        CorporateGovernanceAndDirectorsSection,
        BranchListSection,
        CompanyIdentificationSection,
        CompanyFeaturesSection,
        FinancialAndCapitalInformationSection,
        InformationFromArticlesOfAssociationSection,
        HistoricalInformationSection,
        RepresentativesSection,
        InformationOnCorporateActivitySection,
    } = prospectHistoryResponse?.COCCompanyReport || {};

    const rapresentive = convertObjectToArray(RepresentativesSection?.RepresentativeList?.Representative)
    const shareholder= convertObjectToArray(Shareholders?.ShareholdersList?.Shareholder)

    const result = {
        informazioneN : getInformazione(codiciFiscaliAndCustomCode,codiceFiscale),
        registry: {
            businessName: CompanyIdentificationSection?.CompanyName?._text || '',
            taxCode: CompanyIdentificationSection?.TaxCode?._text || '',//UGUALE
            iva: CompanyIdentificationSection?.TaxCode?._text || '',
            codeREAWithProvince: CompanyIdentificationSection?.REAProvinceCode?._text + CompanyIdentificationSection?.REANumber?._text || '',
            codeREA: CompanyIdentificationSection?.REANumber?._text || '',
            site: `${CompanyIdentificationSection?.RHOAddress?.ToponymCode?._attributes?.description} ${CompanyIdentificationSection?.RHOAddress?.StreetName?._text} ${CompanyIdentificationSection?.RHOAddress?.StreetNo?._text} CAP ${CompanyIdentificationSection?.RHOAddress?.PostCode?._text} ${CompanyIdentificationSection?.RHOAddress?.City?._text} (${CompanyIdentificationSection?.RHOAddress?.ProvinceCode?._text})` || '',
            legalForm: CompanyFeaturesSection?.CompanyFeatures?.CompanyTitle?._attributes?.description || '',
            stateOfCompany: DeliveryAndSummaryDetails?.CompanySituation?._text || '',
            startCompanyDate: CompanyActivitySection?.ActivityStartDate?.Value?._text || '', // 14/01/2011
            authorizedSocialCapital: new Intl.NumberFormat('de-DE').format(FinancialAndCapitalInformationSection?.FinancialAndCapitalInformation?.ShareholdersEquityCapitalShares?.EquityCapital?.Authorized?.OriginalCurrencyValue?._text || 0) || '',
            activity: CompanyIdentificationSection?.RHOSlimActivityList?.SlimBusinessActivity?.Code?._attributes?.description || CompanyIdentificationSection?.RHOSlimActivityList?.SlimBusinessActivity[0]?.Code?._attributes?.description || '',
            performedActivity: CompanyActivitySection?.CompanyActivity?._text || '', // lungo
            raeCode: ItemInformation?.RaeCode?._text || '',
            saeCode: ItemInformation?.SaeCode?._text || '',
            naceCode: CompanyActivitySection?.CompanyActivityList?.BusinessActivity[0]?.Code?._text || '', //43.22.01
            certifiedEmail: CompanyIdentificationSection?.CertifiedEmail?._text || '',
            typeOfContribution: FinancialAndCapitalInformationSection?.FinancialAndCapitalInformation?.ShareholdersEquityCapitalShares?.EquityCapital?.ConfermentTypeCode?._attributes?.description || '',
            subscribedSocialCapital: new Intl.NumberFormat('de-DE').format(FinancialAndCapitalInformationSection?.FinancialAndCapitalInformation?.ShareholdersEquityCapitalShares?.EquityCapital?.Subscribed?.OriginalCurrencyValue?._text || 0) || '',
            paidUpSocialCapital: new Intl.NumberFormat('de-DE').format(FinancialAndCapitalInformationSection?.FinancialAndCapitalInformation?.ShareholdersEquityCapitalShares?.EquityCapital?.Paidup?.OriginalCurrencyValue?._text || 0) || '',
            eu: FinancialAndCapitalInformationSection?.FinancialAndCapitalInformation?.ShareholdersEquityCapitalShares?.EquityCapital?.Currency?._text || '',
            euro: FinancialAndCapitalInformationSection?.FinancialAndCapitalInformation?.ShareholdersEquityCapitalShares?.EquityCapital?.CurrencyType?._text || '',
        },
        legalData: {
            companyRegisterBusiness: InformationOnIncorporationSection?.ActualData?.QualifiedCoCProvinceCode?._text || '',
            dateIscription: InformationOnIncorporationSection?.ActualData?.REARegistrationDate?.Value?._text || '',
            section: InformationOnIncorporationSection?.ActualData?.CompanyRegistrySpecialSectionList?.SpecialSection[0]?.Code?._attributes?.description || '',
            dateForTheSection: InformationOnIncorporationSection?.ActualData?.CompanyRegistrySpecialSectionList?.SpecialSection[0]?.FirstInscriptionInSectionDate?.Value?._text || '',
        },
        informationStatute: {
            dateCostitution: InformationOnIncorporationSection?.ActualData?.MemorandumAssociation?.MemorandumAssociationDate?.Value?._text || '',
            socialObject: CompanyActivitySection?.CompanyPurpose?._text || '',
            endDate: InformationOnIncorporationSection?.ActualData?.MemorandumAssociation?.ExpectedEndDate?.Value?._text || '',
            socialPacts: HistoricalInformationSection?.ProtocolList?.ProtocolDetail[0]?.CompanyModificationList?.CompanyModification[0]?.CompanyRegistryFilingList?.CompanyRegistryFiling[0]?.CompanyRegistryFilingDetails[0]?.FilingTextList?.FilingText?.TextLine?._text || '',
            withdrawalClauses: {
                title: InformationFromArticlesOfAssociationSection?.InformationFromArticlesOfAssociation?.WithdrawalVetoAndPreemption?.WithdrawalVetoAndPreemptionSubTypeList?.WithdrawalVetoAndPreemptionSubType[0]?.SubType?._attributes?.description || '',
                text: InformationFromArticlesOfAssociationSection?.InformationFromArticlesOfAssociation?.WithdrawalVetoAndPreemption?.WithdrawalVetoAndPreemptionSubTypeList?.WithdrawalVetoAndPreemptionSubType[0]?.WithdrawalVetoAndPreemptionSubTypeText?.TextLine?._text || ''
            },
            preEmptionClauses: {
                title: InformationFromArticlesOfAssociationSection?.InformationFromArticlesOfAssociation?.WithdrawalVetoAndPreemption?.WithdrawalVetoAndPreemptionSubTypeList?.WithdrawalVetoAndPreemptionSubType[1]?.SubType?._attributes?.description || '',
                text: InformationFromArticlesOfAssociationSection?.InformationFromArticlesOfAssociation?.WithdrawalVetoAndPreemption?.WithdrawalVetoAndPreemptionSubTypeList?.WithdrawalVetoAndPreemptionSubType[1]?.WithdrawalVetoAndPreemptionSubTypeText?.TextLine?._text || ''
            },
            exclusionClauses: {
                title: InformationFromArticlesOfAssociationSection?.InformationFromArticlesOfAssociation?.WithdrawalVetoAndPreemption?.WithdrawalVetoAndPreemptionSubTypeList?.WithdrawalVetoAndPreemptionSubType[2]?.SubType?._attributes?.description || '',
                text: InformationFromArticlesOfAssociationSection?.InformationFromArticlesOfAssociation?.WithdrawalVetoAndPreemption?.WithdrawalVetoAndPreemptionSubTypeList?.WithdrawalVetoAndPreemptionSubType[2]?.WithdrawalVetoAndPreemptionSubTypeText?.TextLine?._text || '',
            },
            dateOfIncorporation: InformationOnIncorporationSection?.ActualData?.MemorandumAssociation?.FirstAccountingYearEnd?.Value?._text || '',
        },
        administration: {
            form: CorporateGovernanceAndDirectorsSection?.CorporateGovernance?._attributes?.description || '',
            systemOfAdministration: CorporateGovernanceAndDirectorsSection?.CorporateGovernance?._attributes?.description || '',
            administrationForm: CorporateGovernanceAndDirectorsSection?.CorporateGovernanceFormList?.CorporateGovernanceAndSupervisionForm?.FormCode?._attributes?.description || '',
            numberOfAdministration: CorporateGovernanceAndDirectorsSection?.CorporateGovernanceFormList?.CorporateGovernanceAndSupervisionForm?.NumberOfDirectorsInOffice?._text || ''
        },

        legalEvents: {
            actDate: InformationOnCorporateActivitySection?.OperationAndDeedDetailsOfTransferCompanyList?.OperationAndDeedDetailsOfTransferCompany?.DeedDate?.Value?._text || '',
            filingDate: InformationOnCorporateActivitySection?.OperationAndDeedDetailsOfTransferCompanyList?.OperationAndDeedDetailsOfTransferCompany?.DeedFilingDate?.Value?._text || '',
            protocolDate: InformationOnCorporateActivitySection?.OperationAndDeedDetailsOfTransferCompanyList?.OperationAndDeedDetailsOfTransferCompany?.DeedProtocolDate?.Value?._text || '',
            numberProtocol: `${InformationOnCorporateActivitySection?.OperationAndDeedDetailsOfTransferCompanyList?.OperationAndDeedDetailsOfTransferCompany?.REAProvinceCode?._text || ''} ${InformationOnCorporateActivitySection?.OperationAndDeedDetailsOfTransferCompanyList?.OperationAndDeedDetailsOfTransferCompany?.Year?._text || ''} ${InformationOnCorporateActivitySection?.OperationAndDeedDetailsOfTransferCompanyList?.OperationAndDeedDetailsOfTransferCompany?.ProtocolNo?._text || ''}` || '',
            notary: InformationOnCorporateActivitySection?.OperationAndDeedDetailsOfTransferCompanyList?.OperationAndDeedDetailsOfTransferCompany?.Notary?._text || '',
            referenceNo: InformationOnCorporateActivitySection?.OperationAndDeedDetailsOfTransferCompanyList?.OperationAndDeedDetailsOfTransferCompany?.ReferenceNo?._text || '',
            denominationReported: InformationOnCorporateActivitySection?.OperationAndDeedDetailsOfTransferCompanyList?.OperationAndDeedDetailsOfTransferCompany?.ExtraordinaryOperationsInvolvedPersons?.ExOpRepresentativeList?.ExOpRepresentative[0]?.CompanyName?._text || '',
            subjectAssignor: InformationOnCorporateActivitySection?.OperationAndDeedDetailsOfTransferCompanyList?.OperationAndDeedDetailsOfTransferCompany?.ExtraordinaryOperationsInvolvedPersons?.ExOpRepresentativeList?.ExOpRepresentative[0]?.IdentificationCode?._attributes?.description || '',
            taxCodeAssignor: InformationOnCorporateActivitySection?.OperationAndDeedDetailsOfTransferCompanyList?.OperationAndDeedDetailsOfTransferCompany?.ExtraordinaryOperationsInvolvedPersons?.ExOpRepresentativeList?.ExOpRepresentative[0]?.TaxCode?._text || '',
            transferee: InformationOnCorporateActivitySection?.OperationAndDeedDetailsOfTransferCompanyList?.OperationAndDeedDetailsOfTransferCompany?.ExtraordinaryOperationsInvolvedPersons?.ExOpRepresentativeList?.ExOpRepresentative[1]?.CompanyName?._text || '',
            subjectTransferee: InformationOnCorporateActivitySection?.OperationAndDeedDetailsOfTransferCompanyList?.OperationAndDeedDetailsOfTransferCompany?.ExtraordinaryOperationsInvolvedPersons?.ExOpRepresentativeList?.ExOpRepresentative[1]?.IdentificationCode?._attributes?.description || '',
            taxCodeTransferee: InformationOnCorporateActivitySection?.OperationAndDeedDetailsOfTransferCompanyList?.OperationAndDeedDetailsOfTransferCompany?.ExtraordinaryOperationsInvolvedPersons?.ExOpRepresentativeList?.ExOpRepresentative[1]?.TaxCode?._text || ''
        },
        
        lifeTimeClassification: CompanyActivitySection?.CompanyActivityList?.BusinessActivity[0]?.Coding?._attributes?.description || '',

        annualEmployees: {
            employeeNumber: WorkforceSection?.FoundWorkforceList?.FoundWorkforce?.PeriodList?.Period[0]?.InternalWorkforceHeadcount?._text,
            employeeIndipendentNumber: WorkforceSection?.FoundWorkforceList?.FoundWorkforce?.PeriodList?.Period[0]?.TotalWorkforceHeadcount?._text,
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
            secondaryAddress: {
                secondaryRoute: BranchListSection?.BranchList?.Branch?.Location?.Address?.ToponymCode?._text || '',
                secondaryStreet: BranchListSection?.BranchList?.Branch?.Location?.Address?.StreetName?._text || '',
                secondaryStreetNo: BranchListSection?.BranchList?.Branch?.Location?.Address?.StreetNo?._text || '',
                secondaryCity: BranchListSection?.BranchList?.Branch?.Location?.Address?.City?._text || '',
                secondaryPostCode: BranchListSection?.BranchList?.Branch?.Location?.Address?.PostCode?._text || '',
                secondaryProvinceCode: BranchListSection?.BranchList?.Branch?.Location?.Address?.ProvinceCode?._text || '',
            }
        },        
        membersNumber: HistoricalInformationSection?.ProtocolList?.ProtocolDetail[4]?.CompanyModificationList?.CompanyModification.length,
        membersInfo: {
            dateListOfMembers: HistoricalInformationSection?.ProtocolList?.ProtocolDetail[20]?.CompanyModificationList?.CompanyModification?.Deed?.Date?.Value?._text || '',
            dateStorageMembers: HistoricalInformationSection?.ProtocolList?.ProtocolDetail[20]?.Date?.Value?._text || '',
            protocolNumber: `${HistoricalInformationSection?.ProtocolList?.ProtocolDetail[21]?.FormsList?.Form?.DesignatedCoC?._text}/${HistoricalInformationSection?.ProtocolList?.ProtocolDetail[21]?.Year?._text}/${HistoricalInformationSection?.ProtocolList?.ProtocolDetail[20]?.Number?._text}` || ''
        },
        questions: getQuestion(LastTwelveMonthRequests),
        
        balance: haveBilance ? haveBilance : generateBalance(BalanceSheetCebi?.BalanceSheetInfo, CompanyEmployee)

    } as ICribisProspettoStorico;

    let countOfMayors = 0;


    const exponents = rapresentive.map(rap => {
        let result = {
            lastName: rap?.Individual?.LastName?._text || '',
            firstName: rap?.Individual?.FirstName?._text || '',
            taxCode: rap?.TaxCode?._text || '',
            placeOfBirth: `${rap?.Individual?.Birth?.City?._text || ''} (${rap?.Individual?.Birth?.BirthplaceProvinceCode?._text || ''}) il ${rap?.Individual?.Birth?.BirthDate?.Value?._text || ''}` || '',
            residence: `${rap?.Individual?.TaxDomicile?.ToponymCode?._attributes?.description || ''} ${rap?.Individual?.TaxDomicile?.StreetName?._text || ''} ${rap?.Individual?.TaxDomicile?.StreetNo?._text || ''} ${rap?.Individual?.TaxDomicile?.PostCode?._text || ''} ${rap?.Individual?.TaxDomicile?.City?._text || ''} (${rap?.Individual?.TaxDomicile?.ProvinceCode?._text || ''})` || '',
            positionHeld: [] 
        } as any;
        convertObjectToArray(rap?.OfficesAndAuthorityList?.OfficesAndAuthority).map((office: any, index: number) => {
            if(office?.OfficeHeldList?.Office?.Code?._attributes?.description === "SINDACO" || office?.OfficeHeldList?.Office?.Code?._attributes?.description === "sindaco" || office?.OfficeHeldList?.Office?.Code?._attributes?.description === "Sindaco") countOfMayors++

            
            result.positionHeld.push({
                position: office?.OfficeHeldList?.Office?.Code?._attributes?.description || '',
                positionFrom: index === 0
                    ? office?.OfficeHeldList?.Office?.StartDate?.Value?._text
                    : office?.OfficeHeldList?.Office?.AppointmentDeedDate?.Value?._text,
                durationPosition: office?.OfficeHeldList?.Office?.DurationCode?._attributes?.description || '',
                appointedDeedOf: office?.OfficeHeldList?.Office?.OfficeRegistrationDate?.Value?._text || ''
                //dt: CompanyRegistryFilingDetailsFilingTextList.FilingText.TextLine._text
            })
        })
        return result
    })


    const members = shareholder.map((share) => {
        let result = {
            firstName: share?.ShareholderItem?.IndividualInformation?.FirstName?._text || '',
            lastName: share?.ShareholderItem?.IndividualInformation?.LastName?._text || '',
            site: `${share?.ShareholderItem?.IndividualInformation?.ResidenceAddress?.StandardizedStreet?.Toponym?._text || ''} ${share?.ShareholderItem?.IndividualInformation?.ResidenceAddress?.StandardizedStreet?.Street?._text || ''}, ${share?.ShareholderItem?.IndividualInformation?.ResidenceAddress?.StandardizedStreet?.StreetNumber?._text || ''} CAP ${share?.ShareholderItem?.IndividualInformation?.ResidenceAddress?.PostCode?._text || ''} ${share?.ShareholderItem?.IndividualInformation?.ResidenceAddress?.Municipality?._text || ''} (${share?.ShareholderItem?.IndividualInformation?.ResidenceAddress?.Province?._attributes?.Code || ''})` || '',
            taxCode: share?.ShareholderItem?.IndividualInformation?.TaxCode?._text || '',
            nominalValue: `${share?.ValueOfPart?._text || ''} ${share?.CurrencyValueOfPart?._text || ''}` || '',
            percentageShares : share?.PercentageShares?._text || '',
            typeOfRight : share?.DescriptionLinkCode?._text || '',
        }
        return result
    })


    const activityCharacteristics = Array.isArray(CompanyActivitySection?.CompanyActivityList?.BusinessActivity) ? CompanyActivitySection?.CompanyActivityList?.BusinessActivity?.map((activity: any) => {
        return {
            activity: activity?.Code?._attributes?.description || '',
            naceCode: activity?.Code?._text || '',
            importance: activity?.ImportanceCode?._text || ''
        };
    }) : {
        activity: CompanyActivitySection?.CompanyActivityList?.BusinessActivity?.Code?._attributes?.description || '',
        naceCode: CompanyActivitySection?.CompanyActivityList?.BusinessActivity?.Code?._text || '',
        importance: CompanyActivitySection?.CompanyActivityList?.BusinessActivity?.ImportanceCode?._text || ''
    };;

    
    result.exponents = exponents;
    result.members = members;
    result.activityCharacteristics = activityCharacteristics;
    result.countOfMayors = countOfMayors;
    return result
}

function getQuestion(LastTwelveMonthRequests: any): { year: string; month: string; number: string; }[] {
    if(LastTwelveMonthRequests?.TableRaw){
    return LastTwelveMonthRequests?.TableRaw?.map((table : any) => {
        return {
            year: table?.MonthYear?.Year?._text || '',
            month: table?.MonthYear?.Month?._text || '',
            number: table?.Total?._text || ''
        }
    })
}else{
    const today = new Date();
    const mesi = [];

    for (let i = 0; i < 12; i++) {
      const data = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const dataFormat = { year: data.getFullYear().toString(), month: (data.getMonth()).toString(), number: "0" };
      mesi.push(dataFormat);
    }
  
    return mesi;
  }
  

}
