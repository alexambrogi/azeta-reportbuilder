export const Endpoint = {
    productPurchase: () => `${process.env.CERVED_API}`,
    prospectHistory: () => `${process.env.CERVED_API}/accessories_documents`,
    estimationBuilding: (cf: string) => `${process.env.CERVED_API_PRODUCTS}/realEstateData/stima?codiceFiscale=${cf}`,
    baseJointOwnerLand: () => `${process.env.CERVED_API_PRODUCTS}/realEstateData/cointestatari/terreno/base`,
    baseJointOwnerBuilding: () => `${process.env.CERVED_API_PRODUCTS}/realEstateData/cointestatari/fabbricato/base`,
    MainDocumentRetrieve: (id: string, format: string) => `${process.env.CERVED_API}/request/${id}/format/${format}`,
    realEstateDataBase: (cf: string) => `${process.env.CERVED_API_PRODUCTS}/realEstateData/base?codiceFiscale=${cf}`,
    closedDiba: (entrustCode: string) => `${process.env.DIBA_API}/wsEsaCiro/api/v1/closediba/${entrustCode}`
}