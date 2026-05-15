import dotenv from 'dotenv';
import Client from 'ssh2-sftp-client';
import { mongodbConnection } from './database/mongodb/mongodb.connection';
import { postgresConnection } from './database/postgres/postgres.connection';
import { generateQueryVerifyClosedAllEntrust, generateRequestsQueryForTaked, PostgresQuery } from './database/postgres/query/postgres.query';
import { ExecutionJob } from './models/logger.model';
import { CustomError, closeAllConnection, generateReportFromCode, sftpConnection } from './utils';
import { list } from 'pm2';
import { generateMassiveExport } from './services/export-massivo.service';

dotenv.config({ path: ".env" });
const sftp = new Client();
const executionJob = new ExecutionJob();

async function main() {
    try {
        //connessione mongo db
        const mongoConnection = await mongodbConnection({
            user: process.env.MONGODB_USER as string,
            password: process.env.MONGODB_PASSWORD as string,
            host: process.env.MONGODB_HOST as string,
            db: process.env.MONGODB_DB as string,
            port: process.env.MONGODB_PORT as string
        });

        // traccia su mongo inizio esecuzione del job
        await executionJob.start();

        // connessione postgres db
        const pgConnection = await postgresConnection({
            user: process.env.POSTGRES_USER as string,
            password: process.env.POSTGRES_PASSWORD as string,
            host: process.env.POSTGRES_HOST as string,
            db: process.env.POSTGRES_DB as string,
            port: process.env.POSTGRES_PORT as string
        });

        // connessione sftp
        const sftpConn = await sftpConnection(sftp, {
            user: process.env.SFTP_USER as string,
            password: process.env.SFTP_PASSWORD as string,
            host: process.env.SFTP_HOST as string,
            port: process.env.SFTP_PORT as string,
        });

        // PRENDO LE RICHIESTE PER IL CONTROLLO DAL DB CIRO
        const [resultsControl, metadatas] = await pgConnection.query(PostgresQuery.getRequestsQueryForControl);
        for (let request of resultsControl) {
            await generateReportFromCode(request, pgConnection, sftp,true)
        }


        // PRENDO LE RICHIESTE DA DB CIRO
        const query = generateRequestsQueryForTaked();
        const [results, metadata] = await pgConnection.query(query);

        // GESTIONE CODICI RICHIESTE
        for (let request of results) {
            await generateReportFromCode(request, pgConnection, sftp,false)
        }

        // GESTIONE MASSIVI
        let listForMassive : any[] = []
        let entrustIdList = new Set()
        //const [resultsMassive, metadataMassive] = await pgConnection.query(PostgresQuery.getRequestsQuery);
        const [resultsMassive, metadataMassive] = await pgConnection.query(PostgresQuery.getRequestsQueryTiketId);
        for (let request of resultsMassive) {
            entrustIdList.add((request as any).id_entrust);
            listForMassive.push(request)
        }
        for(let entrustId of entrustIdList){
            await generateMassiveExport(listForMassive,sftp,entrustId as string,pgConnection);
        }
            


        // traccia su mongo la fine esecuzione del job (avvenuta con successo)
        await executionJob.complete();

        // chiusura connessioni
        // await closeAllConnection(pgConnection, sftpConn, mongoConnection);

        console.log('END JOB')
        await pgConnection.close();
        await sftp.end();
        await mongoConnection.disconnect();
        // chiude il processo
        //process.exit(0);
        console.log('Active handles:', (process as any)._getActiveHandles());
        console.log('Active requests:', (process as any)._getActiveRequests());
    }
    catch (error) {
        // loggo gli errori solo se la connessione a mongodb è stabilita con successo
        if ((error as CustomError).status !== 502) {
            // traccia su mongo fine esecuzione del job (avvenuta con errore)
            await executionJob.error((error as CustomError).message);
        }
        console.error(error);
    }
};

main();