const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET =
  process.env.JWT_SECRET || "CHANGE_THIS_SECRET_LATER";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, "[]");
}

function getUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(
    USERS_FILE,
    JSON.stringify(users, null, 2)
  );
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

function auth(req, res, next) {

  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authentication required"
    });
  }

  const token = header.substring(7);

  try {

    req.user = jwt.verify(token, JWT_SECRET);

    next();

  } catch {

    return res.status(401).json({
      error: "Invalid or expired session"
    });

  }
}


/*
REGISTER
*/

app.post("/api/auth/register", async (req, res) => {

  const email =
    String(req.body.email || "")
      .trim()
      .toLowerCase();

  const password =
    String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password are required"
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: "Password must be at least 8 characters"
    });
  }

  const users = getUsers();

  if (users.some(user => user.email === email)) {
    return res.status(409).json({
      error: "An account with this email already exists"
    });
  }

  const passwordHash =
    await bcrypt.hash(password, 12);

  const user = {
    id: Date.now().toString(),
    email,
    passwordHash,

    plan: "premium_trial",

    trialStartedAt:
      new Date().toISOString(),

    subscriptionStatus: "trialing",

    createdAt:
      new Date().toISOString()
  };

  users.push(user);

  saveUsers(users);

  const token = createToken(user);

  res.status(201).json({
    message: "Account created",
    token,
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan,
      subscriptionStatus:
        user.subscriptionStatus,
      trialStartedAt:
        user.trialStartedAt
    }
  });

});


/*
LOGIN
*/

app.post("/api/auth/login", async (req, res) => {

  const email =
    String(req.body.email || "")
      .trim()
      .toLowerCase();

  const password =
    String(req.body.password || "");

  const users = getUsers();

  const user =
    users.find(u => u.email === email);

  if (!user) {
    return res.status(401).json({
      error: "Invalid email or password"
    });
  }

  const valid =
    await bcrypt.compare(
      password,
      user.passwordHash
    );

  if (!valid) {
    return res.status(401).json({
      error: "Invalid email or password"
    });
  }

  const token = createToken(user);

  res.json({
    message: "Login successful",
    token,
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan,
      subscriptionStatus:
        user.subscriptionStatus,
      trialStartedAt:
        user.trialStartedAt
    }
  });

});


/*
CURRENT USER
*/

app.get("/api/auth/me", auth, (req, res) => {

  const users = getUsers();

  const user =
    users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({
      error: "User not found"
    });
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan,
      subscriptionStatus:
        user.subscriptionStatus,
      trialStartedAt:
        user.trialStartedAt,
      createdAt:
        user.createdAt
    }
  });

});


/*
SUBSCRIPTION STATUS
*/

app.get("/api/billing/status", auth, (req, res) => {

  const users = getUsers();

  const user =
    users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({
      error: "User not found"
    });
  }

  const trialStart =
    new Date(user.trialStartedAt);

  const trialEnd =
    new Date(
      trialStart.getTime() +
      14 * 24 * 60 * 60 * 1000
    );

  const now = new Date();

  const trialActive =
    now < trialEnd;

  res.json({

    plan: user.plan,

    subscriptionStatus:
      user.subscriptionStatus,

    trialActive,

    trialStartedAt:
      user.trialStartedAt,

    trialEndsAt:
      trialEnd.toISOString()

  });

});


/*
HEALTH CHECK
*/

app.get("/api/health", (req, res) => {

  res.json({
    ok: true,
    app: "B2B Wholesale Pricing Fast"
  });

});


app.listen(PORT, "0.0.0.0", () => {

  console.log("");
  console.log("==================================");
  console.log(" B2B Wholesale Pricing Fast");
  console.log("==================================");
  console.log("");
  console.log(`Server running on port ${PORT}`);
  console.log("");
});
