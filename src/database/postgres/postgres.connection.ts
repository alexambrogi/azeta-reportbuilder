import { Sequelize } from 'sequelize';
import { CustomError } from '../../utils';
import { IDatabaseOptions } from '../database.model';

/**
 * Questa funzione permette la connessione al database postgres
 */
export const postgresConnection = async (options : IDatabaseOptions) => {
    try {
        const sequelize = new Sequelize(options.db, options.user, options.password, {
            dialect: "postgres",
            host : options.host,
            port : parseInt(options.port)
        });      
        await sequelize.authenticate();
        return (sequelize as Sequelize);
    }
    catch(error){
        throw new CustomError(500,'Something went wrong with postgres connection');
    }
} 
/**
 * Questa funzione ti disconnette da postgres
 */
export const postgresDisconnection = async (pgConnection : Sequelize) => {
    try {
        await pgConnection.close()
    }
    catch(error){
        throw new CustomError(500,'Something went wrong with postgres disconnection');
    }
}