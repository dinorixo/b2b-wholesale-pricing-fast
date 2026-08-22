const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "database.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const EMPTY_DB = {
  shops: [],
  users: [],
  sessions: [],
  pricingRules: [],
  customerGroups: [],
  priceLists: [],
  settings: []
};

function readDB() {
  try {
    const db = JSON.parse(
      fs.readFileSync(DB_FILE, "utf8")
    );

    // Automatically add new collections
    // if an older database exists.
    for (const key of Object.keys(EMPTY_DB)) {
      if (!Array.isArray(db[key])) {
        db[key] = [];
      }
    }

    return db;

  } catch {
    return JSON.parse(
      JSON.stringify(EMPTY_DB)
    );
  }
}

function writeDB(db) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2)
  );
}

function createId(prefix) {
  return (
    prefix +
    "_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .substring(2, 10)
  );
}


/*
========================================
SHOP
========================================
*/

function createShop(shopDomain, shopName = "") {

  const db = readDB();

  const existing =
    db.shops.find(
      shop => shop.shopDomain === shopDomain
    );

  if (existing) {
    return existing;
  }

  const now =
    new Date().toISOString();

  const shop = {
    id: createId("shop"),

    shopDomain,

    shopName,

    plan: "premium_trial",

    subscriptionStatus: "trialing",

    trialStartedAt: now,

    createdAt: now,

    updatedAt: now
  };

  db.shops.push(shop);

  db.settings.push({

    id: createId("settings"),

    shopId: shop.id,

    currency: "USD",

    wholesaleEnabled: true,

    requireCustomerApproval: true,

    hideWholesalePrices: true,

    automaticTiers: true,

    createdAt: now,

    updatedAt: now

  });

  writeDB(db);

  return shop;
}


function getShop(shopDomain) {

  const db = readDB();

  return (
    db.shops.find(
      shop => shop.shopDomain === shopDomain
    ) || null
  );
}


function getShopById(shopId) {

  const db = readDB();

  return (
    db.shops.find(
      shop => shop.id === shopId
    ) || null
  );
}


/*
========================================
USERS
========================================
*/

function createUser(
  shopId,
  name,
  email,
  passwordHash
) {

  const db = readDB();

  const existing =
    db.users.find(
      user =>
        user.shopId === shopId &&
        user.email.toLowerCase() ===
          email.toLowerCase()
    );

  if (existing) {
    return null;
  }

  const now =
    new Date().toISOString();

  const user = {

    id: createId("user"),

    shopId,

    name,

    email:
      email.toLowerCase(),

    passwordHash,

    role: "owner",

    createdAt: now,

    updatedAt: now

  };

  db.users.push(user);

  writeDB(db);

  return user;
}


function getUserByEmail(
  shopId,
  email
) {

  const db = readDB();

  return (
    db.users.find(
      user =>
        user.shopId === shopId &&
        user.email.toLowerCase() ===
          email.toLowerCase()
    ) || null
  );
}


function getUserById(userId) {

  const db = readDB();

  return (
    db.users.find(
      user => user.id === userId
    ) || null
  );
}


/*
========================================
SESSIONS
========================================
*/

function createSession(
  userId,
  token
) {

  const db = readDB();

  const session = {

    id: createId("session"),

    userId,

    token,

    createdAt:
      new Date().toISOString()

  };

  db.sessions.push(session);

  writeDB(db);

  return session;
}


function getSession(token) {

  const db = readDB();

  return (
    db.sessions.find(
      session =>
        session.token === token
    ) || null
  );
}


function deleteSession(token) {

  const db = readDB();

  db.sessions =
    db.sessions.filter(
      session =>
        session.token !== token
    );

  writeDB(db);
}


function getDatabase() {
  return readDB();
}


module.exports = {

  readDB,

  writeDB,

  createShop,

  getShop,

  getShopById,

  createUser,

  getUserByEmail,

  getUserById,

  createSession,

  getSession,

  deleteSession,

  getDatabase

};


/*
========================================
TRIAL SYSTEM
========================================
*/

function getTrialInfo(shop) {

  if (!shop || !shop.trialStartedAt) {
    return {
      active: false,
      daysRemaining: 0
    };
  }

  const start =
    new Date(shop.trialStartedAt)
      .getTime();

  const now =
    Date.now();

  const trialLength =
    14 * 24 * 60 * 60 * 1000;

  const elapsed =
    now - start;

  const remaining =
    Math.max(
      0,
      trialLength - elapsed
    );

  const daysRemaining =
    Math.ceil(
      remaining /
      (24 * 60 * 60 * 1000)
    );

  return {
    active: remaining > 0,
    daysRemaining
  };
}


function updateTrialStatus(shopId) {

  const db = readDB();

  const shop =
    db.shops.find(
      shop => shop.id === shopId
    );

  if (!shop) {
    return null;
  }

  const trial =
    getTrialInfo(shop);

  if (
    !trial.active &&
    shop.subscriptionStatus === "trialing"
  ) {

    shop.subscriptionStatus =
      "trial_expired";

    shop.plan =
      "free";

    shop.updatedAt =
      new Date().toISOString();

    writeDB(db);
  }

  return shop;
}


module.exports.getTrialInfo =
  getTrialInfo;

module.exports.updateTrialStatus =
  updateTrialStatus;
