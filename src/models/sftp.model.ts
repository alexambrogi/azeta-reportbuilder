export interface ISftpOptions {
    host: string,
    port: string,
    user: string,
    password: string
}

export interface InputDataFromSFTP {
    'nome prodotto'?: string,
    rif_cliente?: string,
    tipoSogg?: string,
    cognome?: string,
    nome?: string,
    denominaz?: string,
    codfisc?: string,
    comRes?: string,
    sede?: string,
    indirizzo?: string,
    telefono?: string,
    cellulare?: string,
    note?: string,
    urgente?: string
}

export interface InputDataCustomer {
    productName?: string,
    refCustomer?: string,
    subjectType?: string,
    surname?: string,
    name?: string,
    denomination?: string,
    taxCode?: string,
    comRes?: string,
    site?: string,
    address?: string,
    phone?: string,
    mobilePhone?: string,
    note?: string,
    urgent?: string
}

export interface BalanceSheetExcel {
'piva/cf' : string,
'Data Chiusura Bilancio anno N' : number,
'VALORE DELLA PRODUZIONE anno N' : string,
'RICAVI anno N' : string,
'FATTURATO anno N' : string,
'CASH FLOW anno N' : string,
'UTILE(PERDITA) ESERCIZIO anno N' : string,
'TOTALE ATTIVO anno N' : string,
'A. CREDITI VERSO SOCI anno N' : string,
'IMMOBILIZZAZIONI anno N' : string,
'PATRIMONIO NETTO anno N' : string,
'TFR anno N' : string,
'NUMERO DIPENDENTI anno N' : string,
'Data Chiusura Bilancio anno N-1' : number,
'VALORE DELLA PRODUZIONE anno N-1' : string,
'RICAVI anno N-1' : string,
'FATTURATO anno N-1' : string,
'CASH FLOW anno N-1' : string,
'UTILE(PERDITA) ESERCIZIO anno N-1' : string,
'TOTALE ATTIVO anno N-1' : string,
'A. CREDITI VERSO SOCI anno N-1' : string,
'IMMOBILIZZAZIONI anno N-1' : string,
'PATRIMONIO NETTO anno N-1' : string,
'TFR anno N-1' : string,
'NUMERO DIPENDENTI anno N-1' : string,
'Data Chiusura Bilancio anno N -2' : number,
'VALORE DELLA PRODUZIONE anno N-2' : string,
'RICAVI anno N-2' : string,
'FATTURATO anno N-2' : string,
'CASH FLOW anno N-2' : string,
'UTILE(PERDITA) ESERCIZIO anno N-2' : string,
'TOTALE ATTIVO anno N-2' : string,
'A. CREDITI VERSO SOCI anno N-2' : string,
'IMMOBILIZZAZIONI anno N-2' : string,
'PATRIMONIO NETTO anno N-2' : string,
'TFR anno N-2' : string,
'NUMERO DIPENDENTI anno N-2' : string

}