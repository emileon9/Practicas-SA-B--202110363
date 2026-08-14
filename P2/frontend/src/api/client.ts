import axios from "axios";

/**
 * Cliente HTTP centralizado hacia el backend.
 * withCredentials=true es OBLIGATORIO para que el navegador mande y
 * reciba la cookie HttpOnly del JWT en cada peticion.
 */
export const apiClient = axios.create({
    baseURL: "http://localhost:4000",
    withCredentials: true,
});