import mongoose from "mongoose";
import { IDatabaseOptions } from "../database.model";
import { CustomError } from "../../utils";

/**
 * Questa funzione permette la connessione a mongodb
 */
export const mongodbConnection = async (options: IDatabaseOptions) => {
    try {
        const uri = `mongodb://${options.user}:${options.password}@${options.host}:${options.port}/${options.db}?retryWrites=true&writeConcern=majority&authSource=admin`
        //const uri = `mongodb+srv://jmhinocap:tV4ZOZrwaWELrDnD@az.7ivpzhx.mongodb.net/test-az`
        return await mongoose.connect(uri);
    }
    catch (error) {
        throw new CustomError(502, 'Something went wrong with mongodb connection')
    }
}
/**
 * Questa funzione ti disconnette da mongodb
 */
export const mongodbDisconnection = async (mongoConnection: typeof mongoose) => {
    try {
        await mongoConnection.disconnect()
    }
    catch (error) {
        throw new CustomError(500, 'Something went wrong with mongodb disconnection')
    }
}