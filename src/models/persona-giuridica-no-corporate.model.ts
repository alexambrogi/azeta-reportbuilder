import { ICribisPersonaFisica } from "./persona-fisica.model";
import { ICribisPersonaGiuridica } from "./persona-giuridica.model";

export interface ICribisPersonaGiuridicaNoCorporate {
    campaign_kind_id: string,
    company: ICribisPersonaGiuridica,
    legallyResponsible?: ICribisPersonaFisica
}