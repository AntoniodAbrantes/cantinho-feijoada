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
npm run dev:emulador                  # http://localhost:3000, entre com o usuário acima
```

Os dados do emulador ficam salvos em `.emulador/` ao fechar (Ctrl+C) e voltam na próxima vez.

## Testes

```bash
npm test               # contas: custo da porção, lucro por canal, descontos, iFood, preço mínimo, mensalidade, estoque, projeção
npm run test:regras    # regras do Firestore no emulador (só a conta dona lê e escreve)
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
   O seed de produção **não** cria pedidos de exemplo. O script de usuário marca a conta com a claim `dono`, que as regras exigem.

## Deploy na Vercel

1. Suba o repositório para o GitHub e importe na Vercel (framework Next.js, sem configuração extra).
2. Em Settings > Environment Variables, cadastre as 4 variáveis `NEXT_PUBLIC_FIREBASE_*` do `.env.local`.
3. Depois do primeiro deploy, no Firebase: Authentication > Settings > **Authorized domains**, adicione o domínio da Vercel (ex.: `cantinho.vercel.app`).
4. No celular, abra o site e use "Adicionar à tela inicial".

## Como as contas funcionam

- Dinheiro em centavos, percentuais em pontos-base (1% = 100), pesos em gramas. Sem arredondamento acumulado: arredonda por item.
- **Custo por kg** = (soma da nota da produção + temperos + gás das premissas) ÷ rendimento. O pedido usa a produção mais recente com data até o dia do pedido.
- **Custo da porção** = peso × custo/kg + embalagem + peso × mão de obra/kg.
- **Pedido**: bruto − desconto = líquido. iFood: comissão sobre o líquido (ou bruto, nas premissas) + taxa online sobre o cobrado (itens + entrega) quando o pagamento é online. Maquininha (débito/crédito) sobre o cobrado. Lucro = cobrado − taxas − custo dos itens − custo da entrega.
- O pedido **congela** preço, custo e taxas na hora da venda. Mudar preço ou premissa não mexe nos pedidos antigos.
- **Estoque de bebida** baixa no mesmo lote do pedido (`writeBatch` + `increment`), que é atômico e funciona sem internet. Cancelar devolve; reabrir baixa de novo.
- **Saldo do caixa** = recebido nas vendas (já sem taxas) − compras.

## Estrutura

```
src/lib/calc.ts        contas puras (com testes em calc.test.ts)
src/lib/store.tsx      leitura em tempo real do Firestore e gravações
src/data/seed.ts       dados iniciais (fonte do seed)
src/app/               telas: / (painel), /novo, /pedidos, /caixa, /mais/...
scripts/               seed e criação da conta dona (Admin SDK)
firestore.rules        regras de segurança
```

## Coleções no Firestore

| Coleção | O que guarda |
|---|---|
| `config/premissas` | todos os parâmetros: `{valor, origem, estimativa}` |
| `premissasHistorico` | cada alteração de premissa (antes, depois, quando) |
| `produtos` (+ `historicoPreco`) | cardápio, preços por canal, custo, peso, estoque de bebida |
| `producoes` | data, rendimento, insumos com preço pago |
| `pedidos` | itens com preço/custo congelados, desconto, entrega, pagamento, taxas, status |
| `compras` | tudo que saiu do caixa |
| `cenarios` | porções por dia de cada cenário da projeção |
