export const WHATSAPP = "5583998244099";
export const WHATSAPP_TEXTO = "(83) 99824-4099";
export const INSTAGRAM = "cantinhodafeijoadapb";
export const linkInstagram = `https://instagram.com/${INSTAGRAM}`;
export const linkWhatsapp = (msg?: string) => `https://wa.me/${WHATSAPP}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
// WhatsApp do cliente (número salvo só com DDD, sem o 55).
export const linkWhatsappCliente = (telefone: string, msg: string) => `https://wa.me/55${telefone}?text=${encodeURIComponent(msg)}`;
