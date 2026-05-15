import moment from "moment";
import { Sequelize, Transaction } from "sequelize";
import { generateQueryVerifyClosedEntrust, setStateEntrusts, setStateEntrustsAssignment, setStateEntrustsRequest } from "../database/postgres/query/postgres.query";
import { closedDiba } from "./diba-external.service";
import { ExecutionJob } from "../models/logger.model";
import { CustomError } from "../utils";

export async function closeEntrustedAndEntrustedRequest(executionJob: ExecutionJob,transaction : Transaction,pgConnection :Sequelize,investigation_record_id : string,id_request : string, id_entrust : string,campaign_kind_id : string,entrust_code : string) {

    try {
        const now = moment(new Date()).format('DD/MM/YYYY HH:mm:ss');
        await pgConnection.query(setStateEntrustsAssignment(investigation_record_id, 'validated', now))
        await pgConnection.query(setStateEntrustsRequest(id_request, 'completed', now))
        const [results, metadata] = await pgConnection.query(generateQueryVerifyClosedEntrust(id_entrust))
        if (!(results.length) && !['713','714','768','769'].includes(campaign_kind_id)) {
                await pgConnection.query(setStateEntrusts(id_entrust, 'validated', now))
                await closedDiba(entrust_code);
        }
        } catch (error) {
                console.error(error);
                await transaction.rollback()
                await executionJob.error((error as CustomError).message);
                return
        }
    
}

export async function closeEntrusted(pgConnection:Sequelize,transaction:Transaction,executionJob:ExecutionJob,id_entrust:string,entrust_code:string) {
    try {
    const now = moment(new Date()).format('DD/MM/YYYY HH:mm:ss');
    const [results, metadata] = await pgConnection.query(generateQueryVerifyClosedEntrust(id_entrust))
    if (!(results.length)) {
        await pgConnection.query(setStateEntrusts(id_entrust, 'validated', now))
        await closedDiba(entrust_code);
    }
    } catch (error) {
        console.error(error);
        await transaction.rollback()
        await executionJob.error((error as CustomError).message);
        return
    }
}