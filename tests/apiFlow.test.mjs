// Teste de fluxo da API v1 — alimenta o banco com usuário + produtos via HTTP.
// Requer o servidor rodando (npm start) em BASE_URL.
// Uso: node tests/apiFlow.test.mjs

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

async function api(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function main() {
  console.log(`\n== Estoque Inteligente — teste de API (${BASE_URL}) ==\n`);

  // 0. Health
  const health = await api("/health");
  assert(health.status === 200 && health.data.status === "ok", "GET /health responde ok");

  // 1. Registro
  const email = `teste_${Date.now()}@estoque.dev`;
  const password = "Senha@1234";
  console.log(`\n[Auth] Registrando usuário ${email}`);
  const register = await api("/api/auth/register", {
    method: "POST",
    body: { name: "Usuário Teste", email, password, defaultState: "SP" },
  });
  assert(register.status === 201, "POST /api/auth/register cria conta (201)");
  assert(!!register.data?.token, "register retorna token JWT");
  assert(register.data?.isNewUser === true, "register marca isNewUser=true");
  const token = register.data.token;
  const userId = register.data.user?.id;

  // 1b. E-mail duplicado deve falhar
  const dup = await api("/api/auth/register", {
    method: "POST",
    body: { name: "Outro", email, password },
  });
  assert(dup.status === 409, "registro com e-mail duplicado retorna 409");

  // 2. Login
  console.log("\n[Auth] Login");
  const login = await api("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert(login.status === 200 && !!login.data?.token, "POST /api/auth/login autentica");

  // 3. /me
  const me = await api("/api/auth/me", { token });
  assert(me.status === 200 && me.data?.user?.email === email, "GET /api/auth/me retorna o usuário");

  // 4. Sem token -> 401
  const noAuth = await api("/api/products");
  assert(noAuth.status === 401, "GET /api/products sem token retorna 401");

  // 5. Criar produtos
  console.log("\n[Produtos] Criando itens de estoque");
  const seed = [
    { name: "Arroz", category: "grocery", quantity: 5, unit: "kg", minQuantity: 2, avgUnitPrice: 6.5, repurchaseDays: 30 },
    { name: "Leite", category: "dairy", quantity: 12, unit: "un", minQuantity: 6, avgUnitPrice: 4.2 },
    { name: "Detergente", category: "cleaning", quantity: 1, unit: "un", minQuantity: 2 },
    { name: "Café", category: "grocery", quantity: 0, unit: "pack", minQuantity: 1 },
    { name: "Sabonete", category: "hygiene", quantity: 8, unit: "un", minQuantity: 3 },
  ];
  const created = [];
  for (const p of seed) {
    const r = await api("/api/products", { method: "POST", token, body: p });
    assert(r.status === 201, `cria produto ${p.name} (201)`);
    if (r.data?.product) created.push(r.data.product);
  }

  // 6. Listar todos
  const listAll = await api("/api/products", { token });
  assert(listAll.status === 200, "GET /api/products lista");
  assert((listAll.data?.products?.length || 0) >= 5, "lista contém os 5 produtos criados");

  // 7. Status derivado
  const byName = Object.fromEntries((listAll.data.products || []).map((p) => [p.name, p]));
  assert(byName["Café"]?.stockStatus === "out", "Café aparece como 'out' (quantidade 0)");
  assert(byName["Detergente"]?.stockStatus === "low", "Detergente aparece como 'low'");
  assert(byName["Arroz"]?.stockStatus === "ok", "Arroz aparece como 'ok'");

  // 8. Filtro por status low
  const lowList = await api("/api/products?status=low", { token });
  assert(
    lowList.status === 200 && lowList.data.products.every((p) => p.stockStatus === "low"),
    "filtro ?status=low retorna só itens 'low'",
  );

  // 9. Consumir Arroz (5 -> 3)
  console.log("\n[Movimentos] Consumo e baixa");
  const arroz = byName["Arroz"];
  const consume = await api(`/api/products/${arroz.id}/consume`, {
    method: "POST",
    token,
    body: { quantity: 2, note: "Almoço da semana" },
  });
  assert(consume.status === 200 && consume.data.product.quantity === 3, "consume reduz Arroz para 3");

  // 9b. Consumir mais que o estoque -> 400
  const overConsume = await api(`/api/products/${arroz.id}/consume`, {
    method: "POST",
    token,
    body: { quantity: 999 },
  });
  assert(overConsume.status === 400, "consumir acima do estoque retorna 400");

  // 10. Mark-out Leite
  const leite = byName["Leite"];
  const markOut = await api(`/api/products/${leite.id}/mark-out`, { method: "POST", token });
  assert(
    markOut.status === 200 && markOut.data.product.quantity === 0 && markOut.data.product.stockStatus === "out",
    "mark-out zera Leite",
  );

  // 11. Detalhe com histórico de movimentos
  const detail = await api(`/api/products/${arroz.id}`, { token });
  assert(detail.status === 200, "GET /api/products/:id detalha");
  assert((detail.data.product.movements?.length || 0) >= 2, "Arroz tem histórico de movimentos (in + out)");

  // 12. Update produto
  const upd = await api(`/api/products/${arroz.id}`, {
    method: "PATCH",
    token,
    body: { minQuantity: 4, notes: "Comprar no atacado" },
  });
  assert(upd.status === 200 && upd.data.product.minQuantity === 4, "PATCH atualiza minQuantity");

  // Resumo final do estoque
  const finalList = await api("/api/products", { token });
  console.log("\n[Estoque final]");
  console.table(
    (finalList.data.products || []).map((p) => ({
      nome: p.name,
      qtd: p.quantity,
      unidade: p.unit,
      minimo: p.minQuantity,
      status: p.stockStatus,
    })),
  );

  console.log(`\nUsuário criado: ${email} (id=${userId})`);
  console.log(`\n== Resultado: ${passed} passaram, ${failed} falharam ==\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nErro fatal no teste:", err);
  process.exit(1);
});
