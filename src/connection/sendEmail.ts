import nodemailer from "nodemailer";

export async function sendEmail(codiceFiscale: string, entrust_id: string) {
    try {
        const object = {
            host: process.env.EMAIL_HOST,
            logger: true,
            debug: true,
            secure: true,
            port: Number(process.env.EMAIL_PORT) || 0,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        }
        console.error(object)
        const transporter = nodemailer.createTransport(object)
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_TO,
            subject: `ERRORE IN FASE DI COMPILAZIONE DEL PROCESSO BILANCIO PER CF ${codiceFiscale}`,
            text: `IL REPORT CON ENTRUST_ID ${entrust_id} RISULTA SENZA BILANCIO`
        })
        return true
    } catch (except) {
        console.error("email non inviata per il seguente errore : ", except)
        return false
    }

}