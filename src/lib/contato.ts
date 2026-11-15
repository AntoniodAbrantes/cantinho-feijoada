export const WHATSAPP = "5583998244099";
export const WHATSAPP_TEXTO = "(83) 99824-4099";
export const INSTAGRAM = "cantinhodafeijoadapb";
export const linkInstagram = `https://instagram.com/${INSTAGRAM}`;
export const linkWhatsapp = (msg?: string) => `https://wa.me/${WHATSAPP}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
// WhatsApp do cliente (número salvo só com DDD, sem o 55).
export const linkWhatsappCliente = (telefone: string, msg: string) => `https://wa.me/55${telefone}?text=${encodeURIComponent(msg)}`;
// Avaliação no Google: quem dá 4 ou 5 estrelas no site é convidado a avaliar lá também.
// shortcut: falta o link do Perfil da Empresa ("Pedir avaliações"); vazio, o botão não aparece.
export const LINK_AVALIACAO_GOOGLE = "";
// Pix do pedido: a página de acompanhamento mostra QR e copia-e-cola com o valor certo.
// nome: máximo de 25 letras no código Pix (o app do banco mostra o nome completo da conta).
export const PIX = { chave: "68429872000103", nome: "Jose Arthur D de Abrantes", cidade: "João Pessoa" };
