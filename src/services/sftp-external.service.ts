import { Sequelize, Transaction } from "sequelize"
import { PATHFILE, removeLocalPDF, saveFileCiro, sftpCreateFolder, sftpTransferFile } from "../utils"
import Client from 'ssh2-sftp-client';

export async function sendFileWithSFTP(nameFile:string,PATHFILE:string,author_id:string,id_request:string,transaction:Transaction,pgConnection:Sequelize,sftp:Client){
    // // Salva il PDF su CIRO e recupero l'id per il salvataggio su SFTP
    const arrayPartsOfIdAttchaments: any = await saveFileCiro(nameFile, pgConnection, author_id, id_request, PATHFILE, transaction)
    if (arrayPartsOfIdAttchaments === false) return false
    let stringArrayPartsOfIdAttchaments = (arrayPartsOfIdAttchaments[0] as any)

    // Creo il path di salvataggio su SFTP
    const partsOfPathToSave = await sftpCreateFolder(sftp, stringArrayPartsOfIdAttchaments.id, transaction)
    if (partsOfPathToSave === false) return false

    // Salva il PDF nella cartella creata
    const savePdfIntoFolder = await sftpTransferFile(sftp, `${PATHFILE}${nameFile}`, `${partsOfPathToSave}/${nameFile}`, transaction)
    if (savePdfIntoFolder === false) return false

    // Rimuove il PDF dalla cartella locale
    const fileRemoved = await removeLocalPDF(PATHFILE, nameFile, transaction)
    if (fileRemoved === false) return false

    return true
}