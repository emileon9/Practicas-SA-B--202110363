import "dotenv/config";

export const env = {
    port: parseInt(process.env.PORT ?? "5000", 10),
    // Probabilidad de simular una falla temporal (0 a 1).
    // Nos sirve para poder probar el retry loop del backend principal.
    simulateFailureRate: parseFloat(process.env.SIMULATE_FAILURE_RATE ?? "0"),
};