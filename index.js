require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const {
  createShop,
  getShop,
  createUser,
  getUserByEmail,
  getUserById,
  createSession,
  getSession,
  deleteSession
} = require("./database");

const app = express();

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


/*
========================================
AUTH MIDDLEWARE
========================================
*/

function requireAuth(req, res, next) {

  const auth =
    req.headers.authorization;

  if (!auth ||
      !auth.startsWith("Bearer ")) {

    return res.status(401).json({
      success: false,
      error: "Authentication required"
    });

  }

  const token =
    auth.substring(7);

  const session =
    getSession(token);

  if (!session) {

    return res.status(401).json({
      success: false,
      error: "Invalid session"
    });

  }

  const user =
    getUserById(
      session.userId
    );

  if (!user) {

    return res.status(401).json({
      success: false,
      error: "User not found"
    });

  }

  req.user = user;

  next();
}


/*
========================================
SHOP API
========================================
*/

app.get("/api/shop", (req, res) => {

  const shopDomain =
    req.query.shop;

  if (!shopDomain) {

    return res.status(400).json({
      success: false,
      error: "Shop domain is required"
    });

  }

  const shop =
    getShop(shopDomain);

  if (!shop) {

    return res.status(404).json({
      success: false,
      error: "Shop not found"
    });

  }

  res.json({
    success: true,
    shop
  });

});


app.post("/api/shop", (req, res) => {

  const {
    shopDomain,
    shopName
  } = req.body;

  if (!shopDomain) {

    return res.status(400).json({
      success: false,
      error: "shopDomain is required"
    });

  }

  const shop =
    createShop(
      shopDomain,
      shopName || ""
    );

  res.json({
    success: true,
    shop
  });

});


/*
========================================
REGISTER
========================================
*/

app.post(
  "/api/auth/register",
  async (req, res) => {

    try {

      const {
        shopDomain,
        name,
        email,
        password
      } = req.body;

      if (
        !shopDomain ||
        !name ||
        !email ||
        !password
      ) {

        return res.status(400).json({
          success: false,
          error:
            "shopDomain, name, email and password are required"
        });

      }

      if (password.length < 8) {

        return res.status(400).json({
          success: false,
          error:
            "Password must be at least 8 characters"
        });

      }

      const shop =
        createShop(
          shopDomain,
          ""
        );

      const existing =
        getUserByEmail(
          shop.id,
          email
        );

      if (existing) {

        return res.status(409).json({
          success: false,
          error:
            "An account with this email already exists"
        });

      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const user =
        createUser(
          shop.id,
          name,
          email,
          passwordHash
        );

      res.status(201).json({

        success: true,

        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },

        shop: {
          id: shop.id,
          shopDomain:
            shop.shopDomain,
          plan: shop.plan,
          subscriptionStatus:
            shop.subscriptionStatus,
          trialStartedAt:
            shop.trialStartedAt
        }

      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        error: "Registration failed"
      });

    }

  }
);


/*
========================================
LOGIN
========================================
*/

app.post(
  "/api/auth/login",
  async (req, res) => {

    try {

      const {
        shopDomain,
        email,
        password
      } = req.body;

      if (
        !shopDomain ||
        !email ||
        !password
      ) {

        return res.status(400).json({
          success: false,
          error:
            "shopDomain, email and password are required"
        });

      }

      const shop =
        getShop(shopDomain);

      if (!shop) {

        return res.status(404).json({
          success: false,
          error: "Shop not found"
        });

      }

      const user =
        getUserByEmail(
          shop.id,
          email
        );

      if (!user) {

        return res.status(401).json({
          success: false,
          error:
            "Invalid email or password"
        });

      }

      const valid =
        await bcrypt.compare(
          password,
          user.passwordHash
        );

      if (!valid) {

        return res.status(401).json({
          success: false,
          error:
            "Invalid email or password"
        });

      }

      const token =
        crypto.randomBytes(32)
          .toString("hex");

      createSession(
        user.id,
        token
      );

      res.json({

        success: true,

        token,

        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },

        shop: {
          id: shop.id,
          shopDomain:
            shop.shopDomain,
          plan: shop.plan,
          subscriptionStatus:
            shop.subscriptionStatus,
          trialStartedAt:
            shop.trialStartedAt
        }

      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        error: "Login failed"
      });

    }

  }
);


/*
========================================
CURRENT ACCOUNT
========================================
*/

app.get(
  "/api/auth/me",
  requireAuth,
  (req, res) => {

    const shop =
      require("./database")
        .getShopById(
          req.user.shopId
        );

    res.json({

      success: true,

      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      },

      shop: shop
        ? {
            id: shop.id,
            shopDomain:
              shop.shopDomain,
            plan: shop.plan,
            subscriptionStatus:
              shop.subscriptionStatus,
            trialStartedAt:
              shop.trialStartedAt
          }
        : null

    });

  }
);


/*
========================================
LOGOUT
========================================
*/

app.post(
  "/api/auth/logout",
  requireAuth,
  (req, res) => {

    const auth =
      req.headers.authorization;

    const token =
      auth.substring(7);

    deleteSession(token);

    res.json({
      success: true
    });

  }
);


/*
========================================
SERVER
========================================
*/

const PORT =
  process.env.PORT || 3000;

app.listen(
  PORT,
  () => {

    console.log(
      `B2B Wholesale Pricing Fast running at http://localhost:${PORT}`
    );

  }
);


app.get("/api/trial", requireAuth, (req, res) => {

  const database =
    require("./database");

  const shop =
    database.updateTrialStatus(
      req.user.shopId
    );

  if (!shop) {
    return res.status(404).json({
      success: false,
      error: "Shop not found"
    });
  }

  const trial =
    database.getTrialInfo(shop);

  res.json({
    success: true,

    trial: {
      active: trial.active,
      daysRemaining:
        trial.daysRemaining
    },

    shop: {
      plan: shop.plan,
      subscriptionStatus:
        shop.subscriptionStatus
    }
  });

});


/*
========================================
SHOPIFY OAUTH
========================================
*/

const shopify = require("./shopify");

app.get("/api/auth", async (req, res) => {
  try {
    const shop = req.query.shop;

    if (!shop) {
      return res.status(400).send("Missing shop parameter");
    }

    const redirectUrl =
      await shopify.auth.begin({
        shop,
        callbackPath: "/api/auth/callback",
        isOnline: false,
        rawRequest: req,
        rawResponse: res
      });

    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("OAuth begin error:", error);
    res.status(500).json({
      success: false,
      error: "Unable to start Shopify authentication"
    });
  }
});


app.get("/api/auth/callback", async (req, res) => {
  try {
    const {
      session
    } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res
    });

    const shopDomain = session.shop;

    const shop = createShop(
      shopDomain,
      shopDomain
    );

    console.log(
      "Shopify OAuth successful:",
      shopDomain
    );

    return res.redirect(
      "/?shop=" +
      encodeURIComponent(shopDomain)
    );

  } catch (error) {
    console.error(
      "OAuth callback error:",
      error
    );

    return res.status(500).send(
      "Shopify authentication failed"
    );
  }
});
