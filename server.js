const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_FILE = path.join(__dirname, "data", "sales.json");
const mimeTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readSales() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function groupBy(data, key) {
  return data.reduce((result, row) => {
    const label = row[key];
    if (!result[label]) result[label] = { revenue: 0, orders: 0, profit: 0 };
    result[label].revenue += Number(row.revenue || 0);
    result[label].orders += Number(row.orders || 0);
    result[label].profit += Number(row.revenue || 0) - Number(row.cost || 0);
    return result;
  }, {});
}

function monthLabel(date) {
  return new Date(date + "T00:00:00").toLocaleString("en-IN", { month: "short" });
}

function analytics(data) {
  const totalRevenue = data.reduce((sum, row) => sum + row.revenue, 0);
  const totalOrders = data.reduce((sum, row) => sum + row.orders, 0);
  const totalCost = data.reduce((sum, row) => sum + row.cost, 0);
  const profit = totalRevenue - totalCost;
  const averageOrderValue = totalOrders ? Math.round(totalRevenue / totalOrders) : 0;
  const byMonth = data.reduce((result, row) => {
    const label = monthLabel(row.date);
    if (!result[label]) result[label] = { revenue: 0, orders: 0, profit: 0 };
    result[label].revenue += row.revenue;
    result[label].orders += row.orders;
    result[label].profit += row.revenue - row.cost;
    return result;
  }, {});
  return { totalRevenue, totalOrders, profit, averageOrderValue, byMonth, byRegion: groupBy(data, "region"), byCategory: groupBy(data, "category") };
}

function handleApi(req, res) {
  const url = new URL(req.url, "http://localhost");
  const sales = readSales();
  if (url.pathname === "/api/sales") return sendJson(res, 200, { sales });
  if (url.pathname === "/api/analytics") return sendJson(res, 200, { analytics: analytics(sales), sales });
  sendJson(res, 404, { message: "Route not found" });
}

function serveStatic(req, res) {
  const requested = req.url === "/" ? "index.html" : req.url.slice(1).split("?")[0];
  const filePath = path.join(PUBLIC_DIR, requested);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(filePath, (error, content) => {
    if (error) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "text/plain" });
    res.end(content);
  });
}

http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) handleApi(req, res);
  else serveStatic(req, res);
}).listen(PORT, () => console.log("Business Intelligence Dashboard running at http://localhost:" + PORT));
