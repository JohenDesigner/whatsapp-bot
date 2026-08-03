require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GRAPH_API_VERSION = "v20.0";

// Nome da empresa e opções do menu — edite aqui à vontade
const NOME_ASSISTENTE = "Assistente Virtual";
const NOME_EMPRESA = "Johen Artes Gráfica";
const LINK_SITE = "https://johendesigner.github.io/Johen-site/";
const LINK_LOCALIZACAO = "https://www.google.com/maps/search/?api=1&query=Johen+Artes+Gr%C3%A1fica";

// -------------------- 1. Verificação do Webhook (Meta) --------------------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado com sucesso.");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// -------------------- 2. Recebimento de mensagens --------------------
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // sempre responde 200 rápido pra Meta não reenviar

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return; // pode ser status de entrega, etc.

    const from = message.from; // número do cliente
    const contactName = value.contacts?.[0]?.profile?.name || "";

    if (message.type === "text") {
      const texto = message.text.body.trim().toLowerCase();
      await enviarMenuPrincipal(from, contactName);
    } else if (message.type === "interactive") {
      const selectionId =
        message.interactive?.button_reply?.id ||
        message.interactive?.list_reply?.id;
      await tratarSelecaoMenu(from, selectionId);
    }
  } catch (err) {
    console.error("Erro ao processar mensagem:", err.response?.data || err.message);
  }
});

// -------------------- 3. Envio do menu interativo --------------------
async function enviarMenuPrincipal(to, nome) {
  const saudacao = nome ? `Olá, ${nome}!` : "Olá!";

  await enviarMensagem(to, {
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: NOME_EMPRESA },
      body: {
        text: `${saudacao} Eu sou a/o ${NOME_ASSISTENTE} da ${NOME_EMPRESA}. Como posso te ajudar hoje?`,
      },
      footer: { text: "Escolha uma opção abaixo" },
      action: {
        button: "Ver opções",
        sections: [
          {
            title: "Atendimento",
            rows: [
              { id: "site", title: "Site" },
              { id: "localizacao", title: "Localização" },
              { id: "falar_atendente", title: "Falar com John" },
            ],
          },
        ],
      },
    },
  });
}

// -------------------- 4. Tratamento das opções escolhidas --------------------
async function tratarSelecaoMenu(to, selectionId) {
  switch (selectionId) {
    case "site":
      await enviarTexto(
        to,
        `Aqui está o nosso site: ${LINK_SITE} 🎨`
      );
      break;
    case "localizacao":
      await enviarTexto(
        to,
        `É só clicar no link pra ver nossa localização: ${LINK_LOCALIZACAO} 📍`
      );
      break;
    case "falar_atendente":
      await enviarTexto(
        to,
        "Já recebi sua mensagem! Já já eu te respondo por aqui mesmo. 🙂"
      );
      break;
    default:
      await enviarTexto(to, "Não entendi essa opção, pode tentar novamente?");
  }
}

// -------------------- 5. Funções de envio (Graph API) --------------------
async function enviarMensagem(to, payload) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  await axios.post(
    url,
    { messaging_product: "whatsapp", to, ...payload },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
  );
}

async function enviarTexto(to, texto) {
  return enviarMensagem(to, { type: "text", text: { body: texto } });
}

app.get("/", (req, res) => res.send("Bot do WhatsApp rodando ✅"));

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
