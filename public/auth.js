(function () {

  const token = localStorage.getItem("b2b_auth_token");

  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  window.B2B_AUTH_TOKEN = token;

  window.b2bFetch = async function (url, options = {}) {

    options.headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    };

    const response = await fetch(url, options);

    if (response.status === 401) {
      localStorage.removeItem("b2b_auth_token");
      localStorage.removeItem("b2b_user");

      window.location.href = "/login.html";

      return null;
    }

    return response;
  };

  window.b2bLogout = function () {

    localStorage.removeItem("b2b_auth_token");
    localStorage.removeItem("b2b_user");

    window.location.href = "/login.html";
  };

})();
