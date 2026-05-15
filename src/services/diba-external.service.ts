import axios, { AxiosResponse } from "axios";
import { Endpoint } from "../endpoint";
import { env } from "process";

/**
Questa funzione serve a convalidare il risultato tramite chiamata esterna 
*/
export const closedDiba = async (entrustCode: string) => {
    try{
    console.log(`Sending request to ${Endpoint.closedDiba(entrustCode)}`);
    const headers = {'Content-Type': 'application/json','Accept': 'application/json','Content-Length': '0'};
    const { data } = await axios.put(Endpoint.closedDiba(entrustCode),{}, {headers,auth: { username: env.DIBA_USERNAME as string, password: env.DIBA_PASSWORD as string}}) as AxiosResponse;
    console.log("risposta da cerved closedDiba:", JSON.stringify(data))
    return data
    } catch(exce){
        console.error(exce)
    }

}

