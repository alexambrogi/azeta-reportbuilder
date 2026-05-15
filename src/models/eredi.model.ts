import { AnagraficaPersonaFisica } from "./persona-fisica.model"

export interface ICribisEredi {
    nomeDocumento?: string,
    informazioneN? : string,
    campaign_kind_id?: string,
    inputData?: {
        dateRequested: string,
        dateFulfillment: string,
        numberInformation: string,
        refCustomer: string
    },
    registry: any,
    searchHeirs: any,
    acceptingHeirs: any,
    buildings: any,
    conservatoryNote: string,
    notaConservatoriaObject?:{
         accettazione:string,
         campiNota: Array<{
                key:string,
                value:string
         }>
            
    },
    isAccettata: boolean
}