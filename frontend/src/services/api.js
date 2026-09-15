import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");

    // Don't attach an old token to login/register requests
    const isAuthRequest =
      config.url === "/auth/login/" ||
      config.url === "/auth/register/";

    if (token && !isAuthRequest) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    console.log(
      `${config.method?.toUpperCase()} ${config.url} - Token: ${
        token && !isAuthRequest ? "YES" : "NO"
      }`
    );

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;