# Resumen de la Práctica 7 — qué hicimos y dónde está cada cosa

Guía rápida de orientación. Para la documentación formal/técnica de
entrega, usa [README.md](README.md) y los archivos en [docs/](docs/); este
archivo es solo para que ubiques todo rápido.

## ¿Ya terminamos?

**Casi.** Todo lo que se puede automatizar y probar sin tocar
infraestructura externa está hecho y verificado:

- ✅ CI completo (build + test + validación de Docker) — corrido y en
  verde localmente para los 5 microservicios.
- ✅ CD completo en código (helm upgrade + verificación) — validado con
  `helm template` (renderiza bien), pero **nunca se ha ejecutado de verdad
  contra un clúster** porque:
  1. El clúster de GKE de P6 ya no existe (lo borraste para no pagar).
  2. Falta que registres un runner self-hosted en tu PC (así se decidió,
     ver sección "Pendientes de tu parte" más abajo).

Es decir: el pipeline está **implementado y listo**, pero el despliegue
real a Kubernetes requiere que hagas 3 pasos de configuración manual antes
de poder capturar las evidencias finales.

## Qué se hizo, en una frase

Se agregó automatización de CI/CD (GitHub Actions) sobre el sistema de
microservicios que ya tenías de las Prácticas 5 y 6, sin modificar su
arquitectura: cuando haces push, ahora se corre build+test automáticamente,
y cuando haces push a `master` además se construyen y publican las
imágenes Docker y se despliega solo en Kubernetes.

## Mapa de archivos: qué es cada cosa y para qué sirve

### Lo nuevo, organizado por función

| Ruta | Qué es |
|---|---|
| [.github/workflows/ci.yml](../.github/workflows/ci.yml) | El pipeline de Integración Continua. Se dispara con cada `push`/PR. Instala dependencias, compila, corre los tests, y construye (y en `master` publica) las 7 imágenes Docker. |
| [.github/workflows/cd.yml](../.github/workflows/cd.yml) | El pipeline de Despliegue Continuo. Se dispara solo/automáticamente cuando `ci.yml` termina bien en `master`. Hace `helm upgrade` y verifica que el despliegue en Kubernetes funcionó. |
| [P7/helm/values-ci.yaml](helm/values-ci.yaml) | Un archivito de configuración de Helm (parecido al que ya tenías en `P6/helm/values-gke.yaml`) que le dice al chart "las imágenes ahora se descargan de GHCR, no de Artifact Registry ni del daemon local". |
| `P5/services/*/tests/` y `P5/services/{ms-orders,ms-notifications}/tests/` | Las pruebas automatizadas nuevas (no existía ninguna antes). Una carpeta `tests/` dentro de cada microservicio, junto a su código — es donde Jest/pytest esperan encontrarlas. |
| `P5/services/*/package.json` (modificados) | Se les agregó el script `"test": "jest"` y las librerías de testing (Jest, Supertest) como `devDependencies`. |
| `P5/services/{ms-orders,ms-notifications}/{pytest.ini, requirements-dev.txt}` | Configuración de pytest y las dependencias de testing de Python (separadas de `requirements.txt`, que es lo que sí se mete a la imagen Docker final). |

### La documentación de la práctica (para la entrega/nota)

| Ruta | Qué contiene |
|---|---|
| [P7/README.md](README.md) | El documento principal: objetivo, arquitectura, cómo funciona el CI, cómo funciona el CD, Docker, registry, Kubernetes, secrets necesarios, cómo correr todo localmente, problemas conocidos. Es el que un profesor leería primero. |
| [P7/docs/pipeline-diagram.md](docs/pipeline-diagram.md) | El diagrama (Mermaid, se ve directo en GitHub) de todo el flujo, con los nombres reales de los jobs. |
| [P7/docs/preguntas-teoricas.md](docs/preguntas-teoricas.md) | Las 15 preguntas teóricas del enunciado, respondidas apuntando a decisiones reales de este pipeline (no son definiciones genéricas). |
| [P7/docs/rubrica.md](docs/rubrica.md) | Auto-evaluación honesta contra la rúbrica: qué está `[✓]` completo, qué está `[!]` parcial (y por qué), qué falta para el máximo puntaje. |
| [P7/docs/evidencias.md](docs/evidencias.md) | La checklist exacta de capturas de pantalla que debes tomar para la entrega, y en qué orden. |

### Lo que NO se tocó (y por qué es importante saberlo)

- Ningún Dockerfile de `P5/services/*` o `P5/jobs/*` — ya estaban bien.
- El chart de Helm `P5/charts/sa-platform` — se reutiliza tal cual.
- La arquitectura de microservicios — sigue siendo la misma de P4/P5/P6.
- `P6/helm/values-gke.yaml` — ese archivo ya lo tenías modificado antes de
  que empezáramos; no es parte de esta práctica.

## Pendientes de tu parte (sin esto, el CD no puede correr de verdad)

1. En GitHub: `Settings → Actions → General → Workflow permissions` →
   marcar **"Read and write permissions"** (si no, falla el push a GHCR).
2. Registrar tu PC como runner self-hosted: `Settings → Actions → Runners
   → New self-hosted runner` y seguir los pasos que te muestre GitHub.
3. Crear la variable de repositorio `SA_PLATFORM_SECRETS_PATH` (`Settings →
   Secrets and variables → Actions → Variables`) apuntando, en tu PC, a una
   copia de `values-secrets.yaml` guardada **fuera** de la carpeta del
   repositorio (el detalle de por qué está en
   [P7/README.md](README.md#11-secrets-y-configuración-requerida)).
4. Con tu clúster local (Docker Desktop Kubernetes o minikube) encendido y
   el runner corriendo, hacer push a `master` y tomar las capturas de
   [P7/docs/evidencias.md](docs/evidencias.md).

## Cómo probar que todo funciona, ahora mismo, sin tocar GitHub

```bash
# Cualquier servicio Node
cd P5/services/ms-users && npm ci && npm run build && npm test

# Cualquier servicio Python
cd P5/services/ms-orders
python -m venv .venv && .venv/Scripts/activate
pip install -r requirements-dev.txt && pytest -v
```

Todo esto ya lo corrí yo durante la implementación y pasó — lo puedes
repetir para confirmarlo tú mismo.
