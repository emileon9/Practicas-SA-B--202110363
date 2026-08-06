-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('registrada', 'en_proceso', 'completada', 'cancelada');

-- CreateTable
CREATE TABLE "solicitudes_operativas" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "area_solicitante" VARCHAR(100) NOT NULL,
    "prioridad" SMALLINT NOT NULL,
    "costo_estimado" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'registrada',

    CONSTRAINT "solicitudes_operativas_pkey" PRIMARY KEY ("id")
);
