import axios from "axios";
const instance = axios.create({
  baseURL: "https://api.kto.solutions/api/v1",
  headers: {
    "Content-Type": "application/json",
    timeout: 1000,
  },
});

export default instance;
