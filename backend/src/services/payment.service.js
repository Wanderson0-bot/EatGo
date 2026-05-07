const http = require("http");
const https = require("https");
const { URL } = require("url");
const env = require("../config/env");
const AppError = require("../lib/app-error");

const MERCADO_PAGO_API_BASE = "https://api.mercadopago.com";

function sendJsonRequest(urlString, { method = "POST", payload = null, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    let parsedUrl;

    try {
      parsedUrl = new URL(urlString);
    } catch (error) {
      return reject(new AppError(500, "URL do gateway de pagamento invalida."));
    }

    const body = payload ? JSON.stringify(payload) : null;
    const transport = parsedUrl.protocol === "https:" ? https : http;

    const request = transport.request(
      {
        method,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        headers: {
          Accept: "application/json",
          ...(body
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body)
              }
            : {}),
          ...headers
        }
      },
      (response) => {
        let responseBody = "";

        response.on("data", (chunk) => {
          responseBody += chunk;
        });

        response.on("end", () => {
          let parsed = {};

          if (responseBody) {
            try {
              parsed = JSON.parse(responseBody);
            } catch (error) {
              return reject(
                new AppError(502, "Resposta invalida do Mercado Pago.")
              );
            }
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            return resolve(parsed);
          }

          return reject(
            new AppError(
              response.statusCode || 502,
              parsed.message || "Falha ao comunicar com o Mercado Pago."
            )
          );
        });
      }
    );

    request.on("error", (error) => {
      reject(
        new AppError(
          502,
          `Erro de comunicacao com o Mercado Pago: ${error.message}`
        )
      );
    });

    if (body) {
      request.write(body);
    }

    request.end();
  });
}

function normalizeMercadoPagoStatus(status) {
  switch (String(status || "").toLowerCase()) {
    case "approved":
      return "aprovado";
    case "rejected":
      return "rejeitado";
    case "cancelled":
    case "cancelado":
      return "cancelado";
    default:
      return "pendente";
  }
}

async function createCheckoutPreference({
  accessToken,
  orderId,
  reference,
  notificationUrl,
  establishment,
  customer,
  items,
  tipoRecebimento,
  taxaEntrega,
  taxaServico
}) {
  if (!accessToken) {
    throw new AppError(
      400,
      "Este estabelecimento ainda nao configurou a conta do Mercado Pago."
    );
  }

  const baseReturnUrl = `${env.FRONTEND_BASE_URL.replace(/\/$/, "")}/carrinho.html`;
  const returnQuery = `pedido=${encodeURIComponent(orderId)}&ref=${encodeURIComponent(reference)}`;
  const preferencePayload = {
    external_reference: reference,
    statement_descriptor: String(establishment.nome || "EATGO")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .slice(0, 13),
    payer: {
      name: customer.nome,
      email: customer.email
    },
    back_urls: {
      success: `${baseReturnUrl}?${returnQuery}`,
      failure: `${baseReturnUrl}?${returnQuery}`,
      pending: `${baseReturnUrl}?${returnQuery}`
    },
    notification_url: notificationUrl,
    auto_return: "approved",
    items: [
      ...items.map((item) => ({
        id: String(item.id_cardapio),
        title: item.nome,
        description: item.descricao || establishment.nome || "Item do pedido",
        quantity: item.quantidade,
        unit_price: Number(item.preco_unitario),
        currency_id: "BRL"
      })),
      ...(Number(taxaEntrega) > 0
        ? [
            {
              id: "taxa_entrega",
              title: `Taxa de entrega - ${establishment.nome}`,
              description: `Entrega (${tipoRecebimento})`,
              quantity: 1,
              unit_price: Number(taxaEntrega),
              currency_id: "BRL"
            }
          ]
        : []),
      ...(Number(taxaServico) > 0 ? [] : [])
    ],
    metadata: {
      order_id: orderId,
      establishment_id: establishment.id_estabelecimento,
      customer_id: customer.id_cliente
    }
  };

  return sendJsonRequest(`${MERCADO_PAGO_API_BASE}/checkout/preferences`, {
    method: "POST",
    payload: preferencePayload,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
}

async function fetchPaymentDetails({ accessToken, paymentId }) {
  if (!accessToken) {
    throw new AppError(
      400,
      "Este estabelecimento ainda nao configurou a conta do Mercado Pago."
    );
  }

  if (!paymentId) {
    throw new AppError(400, "Identificador do pagamento nao informado.");
  }

  return sendJsonRequest(`${MERCADO_PAGO_API_BASE}/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
}

module.exports = {
  createCheckoutPreference,
  fetchPaymentDetails,
  normalizeMercadoPagoStatus
};
