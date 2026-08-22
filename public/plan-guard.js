(async function () {

  const token = localStorage.getItem("b2b_auth_token");

  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  try {

    const response = await fetch("/api/billing/status", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Unable to check subscription");
    }

    const billing = await response.json();

    /*
      Trial is active OR subscription is active.
    */

    const allowed =
      billing.trialActive === true ||
      billing.subscriptionStatus === "active";

    if (!allowed) {
      window.location.href = "/billing.html";
      return;
    }

    window.B2B_BILLING = billing;

  } catch (error) {

    console.error(error);

    localStorage.removeItem("b2b_auth_token");
    localStorage.removeItem("b2b_user");

    window.location.href = "/login.html";

  }

})();
