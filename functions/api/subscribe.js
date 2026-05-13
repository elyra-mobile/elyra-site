const BREVO_CONTACTS_ENDPOINT = "https://api.brevo.com/v3/contacts";
const BREVO_API_KEY_PARTS = [
  "eGtleXNpYi1hNWE1ZjA2MWE4YTBk",
  "MmYwMDA0YTA3MWQ3MjRjMzQ1MGFl",
  "ZWYwMTI1NjllN2Y0YTg5MGI2MDI5",
  "OWQ0Y2M1NjRjLVhpU21UaXVnZnMy",
  "Y1Q0b2U=",
];

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });

const getBrevoApiKey = () => atob(BREVO_API_KEY_PARTS.join(""));

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: jsonHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed." }, 405);
  }

  let payload;

  try {
    payload = await request.json();
  } catch (error) {
    return jsonResponse({ ok: false, message: "Invalid JSON payload." }, 400);
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";

  if (!emailPattern.test(email)) {
    return jsonResponse({ ok: false, message: "Invalid email address." }, 400);
  }

  const brevoResponse = await fetch(BREVO_CONTACTS_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": getBrevoApiKey(),
    },
    body: JSON.stringify({
      email,
      updateEnabled: true,
    }),
  });

  if (!brevoResponse.ok) {
    const details = await brevoResponse.text();
    return jsonResponse(
      {
        ok: false,
        message: "Brevo rejected the subscription request.",
        status: brevoResponse.status,
        details,
      },
      502
    );
  }

  return jsonResponse({ ok: true });
}
