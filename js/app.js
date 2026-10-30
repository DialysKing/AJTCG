const { SUPABASE_URL, SUPABASE_ANON_KEY, VAT_RATE_PERCENT } = window.AJ_CONFIG;
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = s => document.querySelector(s);
const gbp = p => (p < 0 ? "-£" : "£") + (Math.abs(p) / 100).toFixed(2);
const pence = v => Math.round(parseFloat(v) * 100);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Margin scheme: VAT on profit only (never negative). Standard: VAT inside the full price.
const vatOf = (sale, cost, scheme) =>
  Math.round((scheme === "margin" ? Math.max(sale - cost, 0) : sale) * VAT_RATE_PERCENT / (100 + VAT_RATE_PERCENT));

let items = [], sales = [];

function toast(msg, bad) {
  const t = $("#toast");
  t.textContent = msg; t.className = "show" + (bad ? " bad" : "");
  setTimeout(() => (t.className = ""), 3000);
}

function show(tab) {
  document.querySelectorAll(".tab").forEach(s => (s.hidden = s.id !== tab));
  document.querySelectorAll("#tabs [data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
}

async function load() {
  const [i, s] = await Promise.all([
    db.from("stock_items").select("*").order("name"),
    db.from("sales").select("*, stock_items(name,scheme,unit_cost_pence)").order("sold_at", { ascending: false })
  ]);
  const err = i.error || s.error;
  if (err) return toast(err.message, true);
  items = i.data; sales = s.data;
  render();
}

const remaining = it => it.quantity - sales.filter(s => s.item_id === it.id).reduce((n, s) => n + s.quantity, 0);

function render() {
  $("#stockTable").innerHTML =
    "<tr><th>Item</th><th>Category</th><th>Scheme</th><th class=n>In stock</th><th class=n>Cost each</th></tr>" +
    (items.map(it => {
      const r = remaining(it);
      return `<tr><td>${esc(it.name)}</td><td>${esc(it.category || "")}</td><td>${esc(it.scheme)}</td>
        <td class="n ${r <= 0 ? "low" : ""}">${r}</td><td class=n>${gbp(it.unit_cost_pence)}</td></tr>`;
    }).join("") || "<tr><td colspan=5>No stock yet. Add your first item above.</td></tr>");
  $("#sItem").innerHTML = items.filter(it => remaining(it) > 0)
    .map(it => `<option value="${it.id}">${esc(it.name)} (${remaining(it)} left)</option>`).join("");
  renderVat();
}

function renderVat() {
  const from = $("#vFrom").value, to = $("#vTo").value;
  const rows = sales.filter(s => {
    const d = s.sold_at.slice(0, 10);
    return (!from || d >= from) && (!to || d <= to);
  }).map(s => {
    const cost = s.quantity * s.stock_items.unit_cost_pence;
    return { ...s, cost, vat: vatOf(s.sale_price_pence, cost, s.stock_items.scheme) };
  });
  const sum = k => rows.reduce((n, r) => n + r[k], 0);
  const take = sum("sale_price_pence"), cost = sum("cost"), vat = sum("vat");
  $("#totals").innerHTML =
    `<div>Takings<b>${gbp(take)}</b></div><div>Cost of items<b>${gbp(cost)}</b></div>
     <div class="due">VAT due (estimate)<b>${gbp(vat)}</b></div><div>Profit after VAT<b>${gbp(take - cost - vat)}</b></div>`;
  $("#vatTable").innerHTML =
    "<tr><th>Date</th><th>Item</th><th>Scheme</th><th class=n>Sold for</th><th class=n>Cost</th><th class=n>VAT</th></tr>" +
    rows.map(r => `<tr><td>${r.sold_at.slice(0, 10)}</td><td>${esc(r.stock_items.name)}</td><td>${esc(r.stock_items.scheme)}</td>
      <td class=n>${gbp(r.sale_price_pence)}</td><td class=n>${gbp(r.cost)}</td><td class=n>${gbp(r.vat)}</td></tr>`).join("");
}

$("#addForm").onsubmit = async e => {
  e.preventDefault();
  const { error } = await db.from("stock_items").insert({
    name: $("#aName").value.trim(), category: $("#aCat").value, scheme: $("#aScheme").value,
    quantity: parseInt($("#aQty").value, 10), unit_cost_pence: pence($("#aCost").value)
  });
  if (error) return toast(error.message, true);
  e.target.reset(); toast("Stock added"); load();
};

$("#sellForm").onsubmit = async e => {
  e.preventDefault();
  const it = items.find(x => x.id == $("#sItem").value);
  const qty = parseInt($("#sQty").value, 10);
  if (!it || qty > remaining(it)) return toast("Not enough stock for that sale", true);
  const { error } = await db.from("sales").insert({ item_id: it.id, quantity: qty, sale_price_pence: pence($("#sPrice").value) });
  if (error) return toast(error.message, true);
  e.target.reset(); toast("Sale recorded"); load();
};

$("#loginForm").onsubmit = async e => {
  e.preventDefault();
  const { error } = await db.auth.signInWithPassword({ email: $("#email").value, password: $("#password").value });
  if (error) return toast(error.message, true);
  start();
};
$("#signout").onclick = async () => { await db.auth.signOut(); start(); };
document.querySelectorAll("#tabs [data-tab]").forEach(b => (b.onclick = () => show(b.dataset.tab)));
["#vFrom", "#vTo"].forEach(id => ($(id).onchange = renderVat));

async function start() {
  const { data } = await db.auth.getSession();
  const signedIn = !!data.session;
  $("#login").hidden = signedIn; $("#tabs").hidden = !signedIn;
  if (!signedIn) return document.querySelectorAll(".tab").forEach(s => (s.hidden = true));
  const d = new Date();
  $("#vFrom").value = new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA");
  $("#vTo").value = d.toLocaleDateString("en-CA");
  show("stock"); load();
}
start();
