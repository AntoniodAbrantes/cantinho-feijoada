# Cantinho da Feijoada · gestão

Sistema de pedidos, custos e lucro do Cantinho da Feijoada (delivery em João Pessoa). Substitui a planilha de 7 abas.

Next.js 15 (App Router) + TypeScript + Tailwind v4, Firebase (Auth + Cloud Firestore com cache offline), deploy na Vercel. Instalável como app no celular (PWA).

## Rodar local com o emulador

Precisa de Node 20+ e **Java 21+** (os emuladores do Firebase exigem). No Mac: `brew install openjdk@21` — o script `emuladores` já procura em `/opt/homebrew/opt/openjdk@21`. Em outra máquina, ponha o Java 21 no `PATH`.

```bash
npm install
npm run emuladores                    # terminal 1: Auth (9099), Firestore (8080), painel em http://localhost:4000
npm run seed:emulador                 # terminal 2: dados iniciais + pedidos de exemplo
npm run usuario:emulador -- antonio@cantinho.dev cantinho123
npm run dev:emulador                  # http://localhost:3000/admin, entre com o usuário acima
```

Os dados do emulador ficam salvos em `.emulador/` ao fechar (Ctrl+C) e voltam na próxima vez.

## Testes

```bash
npm test               # contas: custo da porção, lucro por canal, descontos, iFood, preço mínimo, mensalidade, estoque, projeção
npm run test:regras    # no emulador: regras do Firestore e a rota de pedido do site (preço adulterado, esgotado, loja fechada, campos, limites, corrida)
```

A conferência da planilha é teste: individual custa R$ 16,77 e dá R$ 23,13 de lucro no WhatsApp e R$ 21,31 no iFood.

## Criar o projeto no Firebase (uma vez)

1. Em <https://console.firebase.google.com>, crie um projeto (plano Spark, gratuito, basta).
2. **Authentication** > Sign-in method > ative **E-mail/senha**. Em Settings > User actions, desmarque "Enable create (sign-up)": só o script cria a conta.
3. **Firestore Database** > Criar banco, modo produção, região `southamerica-east1` (São Paulo).
4. Configurações do projeto > Seus apps > adicione um app **Web**. Copie os valores para `.env.local` (modelo em `.env.example`).
5. No terminal:
   ```bash
   npx firebase login
   npx firebase use --add          # escolha o projeto; atualiza o .firebaserc
   npm run regras:publicar         # publica firestore.rules e firestore.indexes.json
   ```
6. Seed e usuário em produção: Configurações do projeto > Contas de serviço > **Gerar nova chave privada**. Salve como `service-account.json` na raiz (está no `.gitignore`; não mande para ninguém).
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
   npm run seed                                 # só cria o que falta; pode rodar de novo
   npm run usuario -- seu@email.com suaSenhaForte
   ```
   O seed de produção **não** cria pedidos de exemplo. Em banco que já existia, ele cria `config/loja` e preenche `ativoSite` dos produtos (a feijoada simples fica fora do site), sem mexer no resto. O script de usuário marca a conta com a claim `dono`, que as regras exigem.

## Proteção do pedido pelo site (uma vez, antes de abrir)

O reCAPTCHA clássico (v3) foi descontinuado no App Check; o site usa o **reCAPTCHA Enterprise** (Google Cloud Fraud Defense).

1. No [Google Cloud Console](https://console.cloud.google.com/security/recaptcha), com o projeto do Firebase selecionado: ative a API do reCAPTCHA Enterprise e crie uma chave de **site**, plataforma **Web**, com o domínio do site (ex.: `cantinho-feijoada.vercel.app`) e **sem desafio de caixa de seleção** (baseada em pontuação). Copie o ID da chave.
2. No Firebase: **App Check** > Apps > app Web > **reCAPTCHA Enterprise** > cole o ID da chave.
3. Na Vercel, cadastre `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` com esse ID.

A chave tem que ser do **mesmo projeto** do Firebase (`cantinhosistema-25043`). Chave de outro projeto faz o Firebase responder 400 em `exchangeRecaptchaEnterpriseToken` e todo pedido é recusado com "Não consegui confirmar que o pedido veio do site.". A chave entra no site na publicação: depois de trocar na Vercel, publique de novo.

Sem a chave, a rota de pedido responde "o site ainda não está pronto" (fecha por segurança). No emulador o App Check é pulado.

Não ative "Aplicar" (enforce) do App Check no Firestore: o sistema e a página de acompanhamento leem direto, sem token. Quem precisa do App Check é só a rota de pedido, que confere sozinha.

## Deploy na Vercel

1. Suba o repositório para o GitHub e importe na Vercel (framework Next.js, sem configuração extra).
2. Em Settings > Environment Variables, cadastre as 4 variáveis `NEXT_PUBLIC_FIREBASE_*` do `.env.local` e `FIREBASE_SERVICE_ACCOUNT` (o conteúdo inteiro do `service-account.json`, marcado como sensível). Sem ela o site não mostra o cardápio.
3. Depois do primeiro deploy, no Firebase: Authentication > Settings > **Authorized domains**, adicione o domínio da Vercel (ex.: `cantinho.vercel.app`).
4. No celular, abra o site e use "Adicionar à tela inicial".

## Site público (`/`)

- Página feita no servidor com o Admin SDK (`src/lib/servidor/`), refeita a cada 30 s. Não carrega Firebase nem login no navegador.
- Preço = preço do WhatsApp do cadastro. Aparece só produto com "Vende no site". Esgota quando: marcado à mão, a panela do fim de semana não tem o peso da feijoada, ou a bebida acabou (descontando pedidos novos ainda não aceitos).
- Loja aberta: botão manual ou horário em `config/loja`. Fechada, o cardápio continua visível sem o botão de adicionar.
- Fotos: ponha em `public/fotos/` e o caminho em `src/data/fotos.ts`. Sem foto, a seção fica só com texto.
- Carrinho e dados do cliente ficam no `localStorage` do aparelho dele.
- O pedido vai para `POST /api/pedido` (`src/lib/servidor/pedido.ts`). O navegador manda só quantidades e dados de entrega; o servidor confere App Check (token de uso único), loja aberta, limites (3 pedidos por WhatsApp e 10 por IP a cada hora), cardápio e estoque, recalcula preço e total pelo cadastro e grava pedido `novo`, `rastreio` e número numa transação só. O navegador nunca escreve no Firestore.
- Depois de pedir, o cliente vai para `/pedido/<token>`: número, itens, total e status ao vivo (Recebido, Aceito, Saiu pra entrega, Entregue, ou "não foi aceito" com o motivo). O aparelho guarda os últimos pedidos e a página inicial mostra "Acompanhar seu pedido" por 12 horas.
- `npm run dev:emulador` também serve o site em <http://localhost:3000>.

## Pedidos ao vivo (`/admin/ao-vivo`)

- Deixe aberta no aparelho que fica no balcão e toque em **Ativar som** toda vez que abrir (o navegador não deixa tocar sem um toque). Som desligado aparece em vermelho.
- Pedido novo do site: alarme repete até aceitar ou recusar, a tela pisca amarelo, o título da aba pisca e sai notificação (se permitida). Em qualquer outra tela do sistema o alarme continua e uma faixa amarela leva até os pedidos.
- Aceitar baixa o estoque das bebidas e avisa o cliente na página dele. Antes de aceitar dá pra mudar a taxa de entrega (mais de 4 km). Recusar pede o motivo e abre o WhatsApp do cliente com a mensagem pronta.
- Caiu a conexão: aviso vermelho e um som diferente (dois bipes graves).
- A tela fica acesa enquanto o som estiver ligado (Wake Lock). Volume e som (sirene, apito, sino) ficam guardados no aparelho. No iPhone o volume é o do botão do aparelho.
- Os sons são gerados por `npx tsx scripts/sons.mts` em `public/sons/`.

## Loja no site (`/admin/mais/loja`)

- **Pelo horário**: abre e fecha sozinha nos horários de sexta, sábado e domingo. Sem horário cadastrado, fica fechada.
- **Aberta** ou **Fechada**: vale até mudar de novo. Também dá pra chegar pela tela ao vivo ("Mudar").
- A página do site leva até 30 s pra mostrar a mudança; a rota de pedido confere na hora e recusa com a loja fechada.

## Editar pedido

- Em Pedidos, abra o pedido e toque em **Editar pedido** (ou "Editar itens" na tela ao vivo). Abre a tela de lançar com tudo preenchido; canal, data e dados de entrega do site não mudam.
- Item que já estava no pedido mantém preço e custo da época; item novo entra com o preço e o custo de agora.
- Bebidas: o estoque ajusta só a diferença, e só se o pedido já conta (aceito, saiu, entregue). Pedido do site: o cliente vê os itens e o total novos na página dele. Dá pra desfazer pelo aviso.

## Como as contas funcionam

- Dinheiro em centavos, percentuais em pontos-base (1% = 100), pesos em gramas. Sem arredondamento acumulado: arredonda por item.
- **Custo por kg** = (soma da nota da produção + temperos + gás das premissas) ÷ rendimento. O pedido usa a produção mais recente com data até o dia do pedido.
- **Custo da porção** = peso × custo/kg + embalagem + peso × mão de obra/kg.
- **Pedido**: bruto − desconto = líquido. iFood: comissão sobre o líquido (ou bruto, nas premissas) + taxa online sobre o cobrado (itens + entrega) quando o pagamento é online. Maquininha (débito/crédito) sobre o cobrado. Lucro = cobrado − taxas − custo dos itens − custo da entrega.
- O pedido **congela** preço, custo e taxas na hora da venda. Mudar preço ou premissa não mexe nos pedidos antigos.
- **Estoque de bebida** baixa no mesmo lote do pedido (`writeBatch` + `increment`), que é atômico e funciona sem internet. Cancelar devolve; reabrir baixa de novo.
- **Status do pedido**: `novo` (do site, esperando aceite) → `feito` (aceito) → `saiu` → `entregue`, ou `cancelado`. `novo` e `cancelado` ficam fora dos totais e não baixam bebida; aceitar baixa.
- **Saldo do caixa** = recebido nas vendas (já sem taxas) − compras.

## Estrutura

```
src/lib/calc.ts        contas puras (com testes em calc.test.ts)
src/lib/store.tsx      leitura em tempo real do Firestore e gravações
src/data/seed.ts       dados iniciais (fonte do seed)
src/lib/loja.ts        loja aberta/fechada (botão manual ou horário de config/loja)
src/app/               / é o site público; o sistema fica em /admin: /admin (painel), /admin/novo, /admin/pedidos, /admin/caixa, /admin/mais/...
scripts/               seed e criação da conta dona (Admin SDK)
firestore.rules        regras de segurança
```

## Coleções no Firestore

| Coleção | O que guarda |
|---|---|
| `config/premissas` | todos os parâmetros: `{valor, origem, estimativa}` |
| `config/loja` | `modo` (`auto`, `aberta`, `fechada`) e horário de sexta, sábado e domingo; sem horário, fechada no `auto` |
| `premissasHistorico` | cada alteração de premissa (antes, depois, quando) |
| `produtos` (+ `historicoPreco`) | cardápio, preços por canal, custo, peso, estoque de bebida; `ativoSite` e `esgotadoSite` (o site usa o preço do WhatsApp) |
| `producoes` | data, rendimento, insumos com preço pago |
| `pedidos` | itens com preço/custo congelados, desconto, entrega, pagamento, taxas, status; canal `whatsapp`, `ifood` ou `site` |
| `rastreio` | o que o cliente do site vê do pedido (sem custo, lucro, telefone nem endereço); leitura pública só pelo token |
| `config/contador` | último número de pedido do site |
| `limites` | contagem de pedidos por hora, por WhatsApp e por IP (guardados como hash) |
| `compras` | tudo que saiu do caixa |
| `cenarios` | porções por dia de cada cenário da projeção |
