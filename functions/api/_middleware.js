// Tüm /api/* istekleri için CORS ve merkezi hata yakalama
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export async function onRequest({ request, next }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  let response;
  try {
    response = await next();
  } catch (err) {
    console.error('API hatası:', err);
    response = new Response(
      JSON.stringify({ error: 'Sunucuda beklenmeyen bir hata oluştu. Biraz sonra tekrar dene.' }),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  const out = new Response(response.body, response);
  for (const [key, value] of Object.entries(CORS)) out.headers.set(key, value);
  out.headers.set('Cache-Control', 'no-store');
  return out;
}
