import os
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("PORT", "4003"))

# Practica 10: llamada directa a ms-users (no via el gateway, para no
# crear un salto de ida y vuelta innecesario por el unico punto de
# entrada externo). Mismo namespace que el resto de sa-platform
# (ver P8/helm/platform/values.yaml para el patron de nombres de Service).
USERS_SERVICE_URL = os.getenv(
    "USERS_SERVICE_URL", "http://ms-users.sa-p5.svc.cluster.local:4001"
)
USERS_SERVICE_TIMEOUT_SECONDS = float(os.getenv("USERS_SERVICE_TIMEOUT_SECONDS", "2"))
