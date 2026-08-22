const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "database.json");
const PUBLIC_DIR = path.join(__dirname, "public");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultDatabase() {
  return {
    products: [],
    groups: [],
    priceLists: [],
    rules: [],
    orders: [],
    customers: [],
    settings: {
      storeName: "My Store",
      currency: "INR",
      premium: {
        enabled: false,
        plan: "free"
      }
    }
  };
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(defaultDatabase(), null, 2)
  );
}

function readDatabase() {
  try {
    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    const defaults = defaultDatabase();

    for (const key of Object.keys(defaults)) {
      if (data[key] === undefined) {
        data[key] = defaults[key];
      }
    }

    return data;
  } catch (error) {
    return defaultDatabase();
  }
}

function writeDatabase(db) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(db, null, 2)
  );
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}


/* =========================
   STATIC WEBSITE
========================= */

if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
}


/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    app: "B2B Wholesale Pricing Fast",
    time: new Date().toISOString()
  });
});


/* =========================
   COMPLETE DATABASE
========================= */

app.get("/api/data", (req, res) => {
  res.json(readDatabase());
});


/* =========================
   SETTINGS
========================= */

app.get("/api/settings", (req, res) => {
  const db = readDatabase();

  res.json({
    success: true,
    settings: db.settings || {}
  });
});

app.put("/api/settings", (req, res) => {
  const db = readDatabase();

  db.settings = {
    ...(db.settings || {}),
    ...(req.body || {})
  };

  writeDatabase(db);

  res.json({
    success: true,
    settings: db.settings
  });
});


/* =========================
   PREMIUM
========================= */

app.get("/api/premium", (req, res) => {
  const db = readDatabase();

  const premium =
    db.settings &&
    db.settings.premium
      ? db.settings.premium
      : {
          enabled: false,
          plan: "free"
        };

  res.json({
    success: true,
    premium
  });
});

app.post("/api/premium/activate", (req, res) => {
  const db = readDatabase();

  const plan =
    String(req.body?.plan || "premium");

  db.settings.premium = {
    enabled: true,
    plan,
    activatedAt: new Date().toISOString()
  };

  writeDatabase(db);

  res.json({
    success: true,
    premium: db.settings.premium
  });
});

app.post("/api/premium/deactivate", (req, res) => {
  const db = readDatabase();

  db.settings.premium = {
    enabled: false,
    plan: "free"
  };

  writeDatabase(db);

  res.json({
    success: true,
    premium: db.settings.premium
  });
});


/* =========================
   COLLECTIONS
========================= */

const collections = [
  "products",
  "groups",
  "priceLists",
  "rules",
  "orders",
  "customers"
];


/* =========================
   CUSTOMERS
========================= */

app.get("/api/customers", (req, res) => {
  const db = readDatabase();

  const customers = Array.isArray(db.customers)
    ? db.customers
    : [];

  res.json(customers);
});

app.post("/api/customers", (req, res) => {
  const db = readDatabase();

  if (!Array.isArray(db.customers)) {
    db.customers = [];
  }

  const body = req.body || {};

  const name =
    String(body.name || "").trim();

  if (!name) {
    return res.status(400).json({
      success: false,
      error: "Customer name is required"
    });
  }

  const customer = {
    id: Date.now(),
    name,
    email:
      String(body.email || "").trim(),
    phone:
      String(body.phone || "").trim(),
    group:
      String(body.group || "Retail"),
    address:
      String(body.address || "").trim(),
    createdAt:
      new Date().toISOString()
  };

  db.customers.unshift(customer);

  writeDatabase(db);

  res.status(201).json({
    success: true,
    customer
  });
});


/* =========================
   ORDERS - LIST
========================= */

app.get("/api/orders", (req, res) => {
  const db = readDatabase();

  if (!Array.isArray(db.orders)) {
    db.orders = [];
    writeDatabase(db);
  }

  res.json(db.orders);
});


/* =========================
   ORDERS - CREATE
========================= */

app.post("/api/orders", (req, res) => {
  const db = readDatabase();

  if (!Array.isArray(db.orders)) {
    db.orders = [];
  }

  const body = req.body || {};

  const customerName =
    String(body.customerName || "").trim();

  const items =
    Array.isArray(body.items)
      ? body.items
      : [];

  if (!customerName) {
    return res.status(400).json({
      success: false,
      error: "Customer name is required"
    });
  }

  if (!items.length) {
    return res.status(400).json({
      success: false,
      error: "At least one product is required"
    });
  }

  let subtotal = 0;
  let totalDiscount = 0;
  let units = 0;

  const normalizedItems =
    items.map(item => {

      const quantity =
        Math.max(
          1,
          Number(item.quantity || 1)
        );

      const price =
        Math.max(
          0,
          Number(item.price || 0)
        );

      const discount =
        Math.max(
          0,
          Math.min(
            100,
            Number(item.discount || 0)
          )
        );

      const lineSubtotal =
        price * quantity;

      const lineDiscount =
        lineSubtotal *
        (discount / 100);

      const lineTotal =
        lineSubtotal -
        lineDiscount;

      subtotal += lineSubtotal;
      totalDiscount += lineDiscount;
      units += quantity;

      return {
        productId:
          item.productId || null,

        name:
          String(
            item.name || "Product"
          ),

        sku:
          String(item.sku || ""),

        quantity,

        price,

        discount,

        total:
          money(lineTotal)
      };
    });

  const total =
    money(
      subtotal -
      totalDiscount
    );

  const order = {
    id: Date.now(),

    orderNumber:
      "ORD-" + Date.now(),

    customerName,

    customerEmail:
      String(
        body.customerEmail || ""
      ).trim(),

    customerGroup:
      String(
        body.customerGroup ||
        "Retail"
      ),

    items:
      normalizedItems,

    units,

    subtotal:
      money(subtotal),

    totalDiscount:
      money(totalDiscount),

    total,

    status:
      String(
        body.status ||
        "processing"
      ),

    paymentStatus:
      String(
        body.paymentStatus ||
        "unpaid"
      ),

    notes:
      String(
        body.notes || ""
      ).trim(),

    createdAt:
      new Date().toISOString()
  };

  db.orders.unshift(order);

  /* Update customer automatically */

  if (!Array.isArray(db.customers)) {
    db.customers = [];
  }

  let customer =
    db.customers.find(
      c =>
        c.email &&
        order.customerEmail &&
        c.email.toLowerCase() ===
        order.customerEmail.toLowerCase()
    );

  if (!customer) {
    customer = {
      id: Date.now() + 1,
      name: order.customerName,
      email: order.customerEmail,
      phone: "",
      group: order.customerGroup,
      totalOrders: 0,
      totalSpent: 0,
      createdAt:
        new Date().toISOString()
    };

    db.customers.unshift(customer);
  }

  customer.totalOrders =
    Number(customer.totalOrders || 0) + 1;

  customer.totalSpent =
    money(
      Number(customer.totalSpent || 0) +
      total
    );

  customer.group =
    order.customerGroup;

  writeDatabase(db);

  res.status(201).json({
    success: true,
    order
  });
});


/* =========================
   ORDER UPDATE
========================= */

app.put("/api/orders/:id", (req, res) => {
  const db = readDatabase();

  const id =
    Number(req.params.id);

  const index =
    db.orders.findIndex(
      order => order.id === id
    );

  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: "Order not found"
    });
  }

  db.orders[index] = {
    ...db.orders[index],
    ...(req.body || {}),
    id
  };

  writeDatabase(db);

  res.json({
    success: true,
    order: db.orders[index]
  });
});


/* =========================
   ORDER DELETE
========================= */

app.delete("/api/orders/:id", (req, res) => {
  const db = readDatabase();

  const id =
    Number(req.params.id);

  const before =
    db.orders.length;

  db.orders =
    db.orders.filter(
      order => order.id !== id
    );

  if (db.orders.length === before) {
    return res.status(404).json({
      success: false,
      error: "Order not found"
    });
  }

  writeDatabase(db);

  res.json({
    success: true
  });
});


/* =========================
   COLLECTION GET
========================= */


/* DASHBOARD API */
app.get("/api/dashboard", (req, res) => {
  const db = readDatabase();

  const products = Array.isArray(db.products) ? db.products : [];
  const groups = Array.isArray(db.groups) ? db.groups : [];
  const priceLists = Array.isArray(db.priceLists) ? db.priceLists : [];
  const rules = Array.isArray(db.rules) ? db.rules : [];
  const orders = Array.isArray(db.orders) ? db.orders : [];

  let revenue = 0;
  let units = 0;

  for (const order of orders) {
    revenue += Number(order.total || 0);

    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        units += Number(item.quantity || 0);
      }
    }
  }

  res.json({
    success: true,
    summary: {
      totalRevenue: Number(revenue.toFixed(2)),
      orders: orders.length,
      customers: groups.length,
      products: products.length,
      priceLists: priceLists.length,
      rules: rules.length,
      unitsSold: units
    }
  });
});

app.get("/api/:collection", (req, res) => {

  const collection =
    req.params.collection;

  if (!collections.includes(collection)) {
    return res.status(404).json({
      error: "Collection not found"
    });
  }

  const db = readDatabase();

  res.json(
    Array.isArray(db[collection])
      ? db[collection]
      : []
  );
});


/* =========================
   COLLECTION CREATE
========================= */

app.post("/api/:collection", (req, res) => {

  const collection =
    req.params.collection;

  if (!collections.includes(collection)) {
    return res.status(404).json({
      error: "Collection not found"
    });
  }

  const db = readDatabase();

  if (!Array.isArray(db[collection])) {
    db[collection] = [];
  }

  const item = {
    id: Date.now(),
    ...(req.body || {})
  };

  db[collection].push(item);

  writeDatabase(db);

  res.status(201).json({
    success: true,
    item
  });
});


/* =========================
   COLLECTION UPDATE
========================= */

app.put(
  "/api/:collection/:id",
  (req, res) => {

    const collection =
      req.params.collection;

    if (!collections.includes(collection)) {
      return res.status(404).json({
        error: "Collection not found"
      });
    }

    const db = readDatabase();

    const id =
      Number(req.params.id);

    const index =
      db[collection].findIndex(
        item => item.id === id
      );

    if (index === -1) {
      return res.status(404).json({
        error: "Item not found"
      });
    }

    db[collection][index] = {
      ...db[collection][index],
      ...(req.body || {}),
      id
    };

    writeDatabase(db);

    res.json({
      success: true,
      item: db[collection][index]
    });
  }
);


/* =========================
   COLLECTION DELETE
========================= */

app.delete(
  "/api/:collection/:id",
  (req, res) => {

    const collection =
      req.params.collection;

    if (!collections.includes(collection)) {
      return res.status(404).json({
        error: "Collection not found"
      });
    }

    const db = readDatabase();

    const id =
      Number(req.params.id);

    const before =
      db[collection].length;

    db[collection] =
      db[collection].filter(
        item => item.id !== id
      );

    if (
      db[collection].length ===
      before
    ) {
      return res.status(404).json({
        error: "Item not found"
      });
    }

    writeDatabase(db);

    res.json({
      success: true
    });
  }
);


/* =========================
   ANALYTICS OVERVIEW
========================= */

app.get(
  "/api/analytics/overview",
  (req, res) => {

    const db = readDatabase();

    const orders =
      Array.isArray(db.orders)
        ? db.orders
        : [];

    const products =
      Array.isArray(db.products)
        ? db.products
        : [];

    let revenue = 0;
    let units = 0;
    let discounts = 0;

    const productSales = {};
    const customerSales = {};
    const groupSales = {};
    const dailySales = {};
    const paymentSales = {};
    const statusSales = {};

    orders.forEach(order => {

      const total =
        Number(order.total || 0);

      revenue += total;

      discounts +=
        Number(
          order.totalDiscount ||
          order.discount ||
          0
        );

      const customer =
        order.customerName ||
        "Unknown customer";

      const group =
        order.customerGroup ||
        "Unassigned";

      const payment =
        order.paymentStatus ||
        "unpaid";

      const status =
        order.status ||
        "processing";

      customerSales[customer] =
        (customerSales[customer] || 0) +
        total;

      groupSales[group] =
        (groupSales[group] || 0) +
        total;

      paymentSales[payment] =
        (paymentSales[payment] || 0) +
        1;

      statusSales[status] =
        (statusSales[status] || 0) +
        1;

      const date =
        order.createdAt
          ? String(
              order.createdAt
            ).slice(0, 10)
          : "Unknown";

      if (date !== "Unknown") {
        dailySales[date] =
          (dailySales[date] || 0) +
          total;
      }

      if (
        Array.isArray(order.items)
      ) {

        order.items.forEach(item => {

          const quantity =
            Number(
              item.quantity || 0
            );

          const itemTotal =
            Number(
              item.total || 0
            ) ||
            Number(item.price || 0) *
            quantity;

          units += quantity;

          const key =
            item.productId ||
            item.sku ||
            item.name ||
            "Unknown";

          if (!productSales[key]) {
            productSales[key] = {
              productId:
                item.productId ||
                null,

              name:
                item.name ||
                "Unknown product",

              sku:
                item.sku ||
                "",

              units: 0,
              revenue: 0
            };
          }

          productSales[key].units +=
            quantity;

          productSales[key].revenue +=
            itemTotal;
        });
      }
    });

    const topProducts =
      Object.values(productSales)
        .sort(
          (a, b) =>
            b.revenue - a.revenue
        )
        .slice(0, 10);

    const topCustomers =
      Object.entries(customerSales)
        .map(
          ([name, revenue]) => ({
            name,
            revenue: money(revenue)
          })
        )
        .sort(
          (a, b) =>
            b.revenue - a.revenue
        )
        .slice(0, 10);

    const salesByGroup =
      Object.entries(groupSales)
        .map(
          ([group, revenue]) => ({
            group,
            revenue: money(revenue)
          })
        )
        .sort(
          (a, b) =>
            b.revenue - a.revenue
        );

    const salesByDay =
      Object.entries(dailySales)
        .map(
          ([date, revenue]) => ({
            date,
            revenue: money(revenue)
          })
        )
        .sort(
          (a, b) =>
            a.date.localeCompare(
              b.date
            )
        );

    const paymentStatus =
      Object.entries(paymentSales)
        .map(
          ([status, orders]) => ({
            status,
            orders
          })
        );

    const orderStatus =
      Object.entries(statusSales)
        .map(
          ([status, orders]) => ({
            status,
            orders
          })
        );

    const averageOrderValue =
      orders.length
        ? revenue / orders.length
        : 0;

    res.json({
      success: true,

      summary: {
        totalRevenue:
          money(revenue),

        totalOrders:
          orders.length,

        unitsSold:
          units,

        averageOrderValue:
          money(
            averageOrderValue
          ),

        totalDiscounts:
          money(discounts)
      },

      topProducts,

      bestSellingProducts:
        topProducts,

      topCustomers,

      salesByGroup,

      salesByDay,

      paymentStatus,

      orderStatus,

      productCount:
        products.length,

      customerCount:
        Array.isArray(db.customers)
          ? db.customers.length
          : 0,

      groupCount:
        Array.isArray(db.groups)
          ? db.groups.length
          : 0,

      priceListCount:
        Array.isArray(
          db.priceLists
        )
          ? db.priceLists.length
          : 0,

      ruleCount:
        Array.isArray(db.rules)
          ? db.rules.length
          : 0
    });
  }
);


/* =========================
   DASHBOARD
========================= */

app.get(
  "/api/dashboard",
  (req, res) => {

    const db =
      readDatabase();

    const orders =
      Array.isArray(db.orders)
        ? db.orders
        : [];

    const products =
      Array.isArray(db.products)
        ? db.products
        : [];

    const customers =
      Array.isArray(db.customers)
        ? db.customers
        : [];

    const revenue =
      orders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.total || 0
          ),
        0
      );

    res.json({
      success: true,

      revenue:
        money(revenue),

      orders:
        orders.length,

      customers:
        customers.length,

      products:
        products.length,

      groups:
        Array.isArray(db.groups)
          ? db.groups.length
          : 0,

      priceLists:
        Array.isArray(db.priceLists)
          ? db.priceLists.length
          : 0,

      rules:
        Array.isArray(db.rules)
          ? db.rules.length
          : 0,

      premium:
        db.settings?.premium ||
        {
          enabled: false,
          plan: "free"
        }
    });
  }
);


/* =========================
   EXPORT ORDERS CSV
========================= */

app.get(
  "/api/export/orders.csv",
  (req, res) => {

    const db =
      readDatabase();

    const orders =
      Array.isArray(db.orders)
        ? db.orders
        : [];

    const header =
      [
        "Order Number",
        "Customer",
        "Email",
        "Group",
        "Units",
        "Subtotal",
        "Discount",
        "Total",
        "Status",
        "Payment",
        "Created At"
      ];

    const rows =
      orders.map(order => [

        order.orderNumber,

        order.customerName,

        order.customerEmail,

        order.customerGroup,

        order.units,

        order.subtotal,

        order.totalDiscount,

        order.total,

        order.status,

        order.paymentStatus,

        order.createdAt

      ]);

    const csv =
      [
        header,
        ...rows
      ]
        .map(row =>
          row
            .map(value =>
              `"${String(
                value ?? ""
              ).replace(
                /"/g,
                '""'
              )}"`
            )
            .join(",")
        )
        .join("\n");

    res.setHeader(
      "Content-Type",
      "text/csv"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=orders-report.csv"
    );

    res.send(csv);
  }
);


/* =========================
   SALES REPORT JSON
========================= */

app.get(
  "/api/export/report",
  (req, res) => {

    const db =
      readDatabase();

    const orders =
      Array.isArray(db.orders)
        ? db.orders
        : [];

    const revenue =
      orders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.total || 0
          ),
        0
      );

    res.json({
      success: true,

      generatedAt:
        new Date().toISOString(),

      store:
        db.settings?.storeName ||
        "My Store",

      summary: {
        revenue:
          money(revenue),

        orders:
          orders.length,

        products:
          Array.isArray(db.products)
            ? db.products.length
            : 0,

        customers:
          Array.isArray(db.customers)
            ? db.customers.length
            : 0
      },

      orders
    });
  }
);


/* =========================
   START
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log("");
    console.log(
      "=========================================="
    );
    console.log(
      " B2B Wholesale Pricing Fast"
    );
    console.log(
      " Server running on http://localhost:" +
      PORT
    );
    console.log(
      "=========================================="
    );
    console.log(
      "Dashboard API: /api/dashboard"
    );
    console.log(
      "Analytics API: /api/analytics/overview"
    );
    console.log(
      "Orders API: /api/orders"
    );
    console.log(
      "Customers API: /api/customers"
    );
    console.log(
      "Premium API: /api/premium"
    );
    console.log(
      "Export: /api/export/orders.csv"
    );
    console.log(
      "=========================================="
    );
  }
);
