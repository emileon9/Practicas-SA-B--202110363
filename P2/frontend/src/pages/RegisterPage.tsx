import { useState } from "react";
import type { FormEventHandler } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit: FormEventHandler<HTMLFormElement> = async (e) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            await register(name, email, password);
            // Tras registrarse exitosamente, lo mandamos a hacer login.
            navigate("/login");
        } catch (err: any) {
            setError(err.response?.data?.error ?? "Error al registrar usuario.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div>
                    <span className="auth-card__eyebrow">Nueva cuenta</span>
                    <h1>Registro</h1>
                    <p className="auth-card__subtitle">
                        Crea tu cuenta para empezar a usar la plataforma.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="field">
                        <label htmlFor="register-name">Nombre</label>
                        <input
                            id="register-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="field">
                        <label htmlFor="register-email">Correo</label>
                        <input
                            id="register-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="field">
                        <label htmlFor="register-password">Contraseña</label>
                        <input
                            id="register-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                        />
                    </div>
                    {error && <p className="form-error">{error}</p>}
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                        {isSubmitting ? "Registrando..." : "Registrarme"}
                    </button>
                </form>

                <p className="auth-card__footer">
                    ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
                </p>
            </div>
        </div>
    );
}
