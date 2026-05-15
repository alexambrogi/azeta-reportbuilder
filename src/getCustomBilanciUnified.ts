import * as XLSX from 'xlsx';
import moment from 'moment';
import Client from 'ssh2-sftp-client';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface BalanceDetail {
    productionValue: string;
    revenues: string;
    cashFlow: string;
    profitLoss: string;
    active: string;
    fixedAssets: string;
    netAssets: string;
    numberOfEmployees: string;
    sales: string;
    tfr: string;
    creditToMembers: string;
}

interface BalanceSheetExcelCerved {
    'piva/cf'?: string | number;
    'Data Chiusura Bilancio anno N'?: number | string;
    'VALORE DELLA PRODUZIONE anno N'?: number;
    'RICAVI anno N'?: number;
    'FATTURATO anno N'?: number;
    'CASH FLOW anno N'?: number;
    'UTILE(PERDITA) ESERCIZIO anno N'?: number;
    'TOTALE ATTIVO anno N'?: number;
    'A. CREDITI VERSO SOCI anno N'?: number;
    'IMMOBILIZZAZIONI anno N'?: number;
    'PATRIMONIO NETTO anno N'?: number;
    'TFR anno N'?: number;
    'NUMERO DIPENDENTI anno N'?: number;
    
    'Data Chiusura Bilancio anno N-1'?: number | string;
    'VALORE DELLA PRODUZIONE anno N-1'?: number;
    'RICAVI anno N-1'?: number;
    'FATTURATO anno N-1'?: number;
    'CASH FLOW anno N-1'?: number;
    'UTILE(PERDITA) ESERCIZIO anno N-1'?: number;
    'TOTALE ATTIVO anno N-1'?: number;
    'A. CREDITI VERSO SOCI anno N-1'?: number;
    'IMMOBILIZZAZIONI anno N-1'?: number;
    'PATRIMONIO NETTO anno N-1'?: number;
    'TFR anno N-1'?: number;
    'NUMERO DIPENDENTI anno N-1'?: number;
    
    'Data Chiusura Bilancio anno N -2'?: number | string;
    'VALORE DELLA PRODUZIONE anno N-2'?: number;
    'RICAVI anno N-2'?: number;
    'FATTURATO anno N-2'?: number;
    'CASH FLOW anno N-2'?: number;
    'UTILE(PERDITA) ESERCIZIO anno N-2'?: number;
    'TOTALE ATTIVO anno N-2'?: number;
    'A. CREDITI VERSO SOCI anno N-2'?: number;
    'IMMOBILIZZAZIONI anno N-2'?: number;
    'PATRIMONIO NETTO anno N-2'?: number;
    'TFR anno N-2'?: number;
    'NUMERO DIPENDENTI anno N-2'?: number;
}

interface BalanceSheetExcelSevendata {
    codicefiscale?: string | number;
    codice_fiscale_input?: string | number;
    dt_chiusura_bil?: string;
    valore_produzione?: number;
    ricavi?: number;
    fatturato?: number;
    cash_flow?: number;
    utile_perdita?: number;
    totale_attivo?: number;
    crediti_vs_soci?: number;
    immobilizzazioni?: number;
    patrimonio_netto?: number;
    tfr?: number;
    n_dipendenti?: number;
}

interface BilanciOutput {
    referenceYears: string[];
    balanceDetails: BalanceDetail[];
    balanceDetailsPercentage: any;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const socialCapitalOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
};

// ============================================================================
// MAIN UNIFIED FUNCTION
// ============================================================================

/**
 * Funzione unificata per leggere bilanci da Excel in formato CERVED o SEVENDATA
 * Rileva automaticamente il formato e processa i dati di conseguenza
 * 
 * @param sftp - Client SFTP per recuperare il file
 * @param idAttachments - ID per generare il path del file
 * @param codiceFiscale - Codice fiscale dell'azienda da cercare
 * @returns Oggetto con bilanci o false se non trovati
 */
export const getCustomBilanciUnified = async (
    sftp: Client,
    idAttachments: string,
    codiceFiscale: string
): Promise<BilanciOutput | false | true> => {
    try {
        // Genera il path dinamico del file
        const partsOfPath = generateIdAttachments(idAttachments);
        
        // Recupera il file da SFTP
        const file = await sftp.get(
            `${process.env.BASE_PATH_REQUEST_BILANCI}/${partsOfPath.join("/")}/original/bilanci.xlsx`
        );

        if (!file) {
            console.error('File bilanci.xlsx non trovato');
            return false;
        }

        // Leggi il file Excel
        const workbook = XLSX.read(file, { type: 'buffer' });
        const workSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[workSheetName];
        const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!data || data.length === 0) {
            console.error('File Excel vuoto');
            return true;
        }

        // Rileva il formato in base alle colonne della prima riga
        const format = detectExcelFormat(data[0]);
        
        console.log(`Formato Excel rilevato: ${format}`);

        // Processa in base al formato rilevato
        switch (format) {
            case 'CERVED':
                return parseCervedFormat(data, codiceFiscale);
            
            case 'SEVENDATA':
                return parseSevendataFormat(data, codiceFiscale);
            
            default:
                console.error('Formato Excel non riconosciuto. Colonne disponibili:', Object.keys(data[0]));
                return false;
        }
    } catch (error) {
        console.error('Errore in getCustomBilanciUnified:', error);
        return false;
    }
};

// ============================================================================
// FORMAT DETECTION
// ============================================================================

/**
 * Rileva il formato Excel analizzando le colonne presenti
 */
const detectExcelFormat = (firstRow: any): 'CERVED' | 'SEVENDATA' | 'UNKNOWN' => {
    const columns = Object.keys(firstRow);
    
    // Cerved ha colonne anno N, N-1, N-2
    const hasCervedColumns = columns.some(col => 
        col.includes('anno N') && !col.includes('N-')
    );
    
    // Sevendata ha dt_chiusura_bil e campi in minuscolo
    const hasSevendataColumns = columns.some(col => 
        col === 'dt_chiusura_bil' || col === 'valore_produzione'
    );

    if (hasCervedColumns) {
        return 'CERVED';
    } else if (hasSevendataColumns) {
        return 'SEVENDATA';
    } else {
        return 'UNKNOWN';
    }
};

// ============================================================================
// CERVED FORMAT PARSER
// ============================================================================

/**
 * Processa file Excel in formato CERVED (una riga per azienda, colonne per anno)
 */
const parseCervedFormat = (
    data: BalanceSheetExcelCerved[],
    codiceFiscale: string
): BilanciOutput | false | true => {
    try {
        // Cerca la riga con il codice fiscale specificato
        const azienda = data.find(row => 
            row['piva/cf']?.toString()?.trim() === codiceFiscale?.trim()
        );

        if (!azienda) {
            console.log(`CF ${codiceFiscale} non trovato nel file CERVED`);
            return true;
        }

        const referenceYears: string[] = [];
        const balanceDetails: BalanceDetail[] = [];

        // Anno N
        if (azienda['Data Chiusura Bilancio anno N']) {
            referenceYears.push(convertExcelDateToYear(azienda['Data Chiusura Bilancio anno N']));
            balanceDetails.push(createBalanceDetailCerved(azienda, 'N'));
        }

        // Anno N-1
        if (azienda['Data Chiusura Bilancio anno N-1']) {
            referenceYears.push(convertExcelDateToYear(azienda['Data Chiusura Bilancio anno N-1']));
            balanceDetails.push(createBalanceDetailCerved(azienda, 'N-1'));
        }

        // Anno N-2
        if (azienda['Data Chiusura Bilancio anno N -2']) {
            referenceYears.push(convertExcelDateToYear(azienda['Data Chiusura Bilancio anno N -2']));
            balanceDetails.push(createBalanceDetailCerved(azienda, 'N-2'));
        }

        if (balanceDetails.length === 0) {
            console.log(`Nessun bilancio trovato per CF ${codiceFiscale}`);
            return false;
        }

        return {
            referenceYears,
            balanceDetails,
            balanceDetailsPercentage: generateBalancePercentage(balanceDetails)
        };
    } catch (error) {
        console.error('Errore in parseCervedFormat:', error);
        return false;
    }
};

/**
 * Crea un oggetto BalanceDetail da una riga CERVED per uno specifico anno
 */
const createBalanceDetailCerved = (
    azienda: BalanceSheetExcelCerved,
    anno: 'N' | 'N-1' | 'N-2'
): BalanceDetail => {
    const suffix = anno === 'N' ? 'anno N' : anno === 'N-1' ? 'anno N-1' : 'anno N-2';
    
    return {
        productionValue: formatNumber(azienda[`VALORE DELLA PRODUZIONE ${suffix}` as keyof BalanceSheetExcelCerved] as number),
        revenues: formatNumber(azienda[`RICAVI ${suffix}` as keyof BalanceSheetExcelCerved] as number),
        cashFlow: formatNumber(azienda[`CASH FLOW ${suffix}` as keyof BalanceSheetExcelCerved] as number),
        profitLoss: formatNumber(azienda[`UTILE(PERDITA) ESERCIZIO ${suffix}` as keyof BalanceSheetExcelCerved] as number),
        active: formatNumber(azienda[`TOTALE ATTIVO ${suffix}` as keyof BalanceSheetExcelCerved] as number),
        fixedAssets: formatNumber(azienda[`IMMOBILIZZAZIONI ${suffix}` as keyof BalanceSheetExcelCerved] as number),
        netAssets: formatNumber(azienda[`PATRIMONIO NETTO ${suffix}` as keyof BalanceSheetExcelCerved] as number),
        numberOfEmployees: (azienda[`NUMERO DIPENDENTI ${suffix}` as keyof BalanceSheetExcelCerved] as number)?.toString() || '0',
        sales: formatNumber(azienda[`RICAVI ${suffix}` as keyof BalanceSheetExcelCerved] as number),
        tfr: formatNumber(azienda[`TFR ${suffix}` as keyof BalanceSheetExcelCerved] as number),
        creditToMembers: formatNumber(azienda[`A. CREDITI VERSO SOCI ${suffix}` as keyof BalanceSheetExcelCerved] as number)
    };
};

// ============================================================================
// SEVENDATA FORMAT PARSER
// ============================================================================

/**
 * Processa file Excel in formato SEVENDATA (multiple righe per azienda, una riga = un anno)
 */
const parseSevendataFormat = (
    data: BalanceSheetExcelSevendata[],
    codiceFiscale: string
): BilanciOutput | false | true => {
    try {
        // Filtra tutte le righe per il codice fiscale specificato
        const bilanciAzienda = data.filter(row => {
            const cfRow = (row.codicefiscale || row.codice_fiscale_input)?.toString()?.trim();
            return cfRow === codiceFiscale?.trim();
        });

        if (bilanciAzienda.length === 0) {
            console.log(`CF ${codiceFiscale} non trovato nel file SEVENDATA`);
            return true;
        }

        // Ordina per data (più recente prima)
        bilanciAzienda.sort((a, b) => {
            const dateA = moment(a.dt_chiusura_bil, 'YYYY-MM-DD');
            const dateB = moment(b.dt_chiusura_bil, 'YYYY-MM-DD');
            return dateB.diff(dateA); // DESC order
        });

        const referenceYears: string[] = [];
        const balanceDetails: BalanceDetail[] = [];

        // Processa ogni bilancio trovato
        for (const bilancio of bilanciAzienda) {
            if (!bilancio.dt_chiusura_bil) {
                continue;
            }

            // Estrai l'anno
            const year = moment(bilancio.dt_chiusura_bil, 'YYYY-MM-DD').format('YYYY');
            referenceYears.push(year);

            // Crea oggetto BalanceDetail
            balanceDetails.push(createBalanceDetailSevendata(bilancio));
        }

        if (balanceDetails.length === 0) {
            console.log(`Nessun bilancio valido trovato per CF ${codiceFiscale}`);
            return true;
        }

        return {
            referenceYears,
            balanceDetails,
            balanceDetailsPercentage: generateBalancePercentage(balanceDetails)
        };
    } catch (error) {
        console.error('Errore in parseSevendataFormat:', error);
        return false;
    }
};

/**
 * Crea un oggetto BalanceDetail da una riga SEVENDATA
 */
const createBalanceDetailSevendata = (bilancio: BalanceSheetExcelSevendata): BalanceDetail => {
    return {
        productionValue: formatNumber(bilancio.valore_produzione),
        revenues: formatNumber(bilancio.ricavi),
        cashFlow: formatNumber(bilancio.cash_flow),
        profitLoss: formatNumber(bilancio.utile_perdita),
        active: formatNumber(bilancio.totale_attivo),
        fixedAssets: formatNumber(bilancio.immobilizzazioni),
        netAssets: formatNumber(bilancio.patrimonio_netto),
        numberOfEmployees: bilancio.n_dipendenti?.toString() || '0',
        sales: formatNumber(bilancio.ricavi), // Nota: duplica revenues
        tfr: formatNumber(bilancio.tfr),
        creditToMembers: formatNumber(bilancio.crediti_vs_soci)
    };
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formatta un numero secondo il formato tedesco (punto per migliaia)
 */
const formatNumber = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) {
        return '0';
    }
    
    return Intl.NumberFormat('de-DE', socialCapitalOptions)
        .format(parseInt(value.toString()))
        .toString()
        .replace(',00', '');
};

/**
 * Converte una data Excel (numero) in anno (stringa)
 * Formula: new Date(1899, 11, 30).getTime() + (dateIntoNumber * 86400000)
 */
const convertExcelDateToYear = (dateValue: number | string): string => {
    if (typeof dateValue === 'string') {
        // Se è già una stringa, prova a parsarla
        return moment(dateValue, ['YYYY-MM-DD', 'DD/MM/YYYY']).format('YYYY');
    }
    
    // Converti il numero Excel in data
    const date = new Date(new Date(1899, 11, 30).getTime() + (dateValue * 86400000));
    return moment(date).format('YYYY');
};

/**
 * Genera le percentuali di variazione tra i bilanci
 * Placeholder - implementare la logica reale
 */
const generateBalancePercentage = (balanceDetails: BalanceDetail[]): any => {
    // TODO: Implementare calcolo percentuali
    // Esempio: variazione anno su anno per ogni campo
    return {};
};

export function generateIdAttachments(idOfAttachments: string) {

    while (idOfAttachments.length != 9) {
        idOfAttachments = '0' + idOfAttachments
    }
    let arrayPartsOfIdAttchament: string[] = []
    for (let i = 3; i <= 9; i += 3) {
        arrayPartsOfIdAttchament.push(idOfAttachments.substring(i - 3, i));

    }
    return arrayPartsOfIdAttchament;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default getCustomBilanciUnified;

// Esporta anche i parser individuali per uso standalone
export { parseCervedFormat, parseSevendataFormat, detectExcelFormat };
