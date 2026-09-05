# Preguntas teóricas



1. ¿Qué es Helm y qué problema resuelve frente a los manifiestos sueltos?

    Helm es una herramienta utilizada para kubernetes, este es el administrador de paquetes para kubernetes. Resuelve este problema haciendo más sencillo el despliegue de una aplicación en kubernetes, ya que sin Helm debemos configurar varios archivos YAML e incluso podrían haber repetidos, mientras que con Helm te permite reutilizar un mismo archivo para distintas configuraciones.

#
2. ¿Cuál es la diferencia entre chart, release y repository?

chart: es el paquete o plantilla de la aplicacion

release: es una instancia de un chart, es decir, es una instalacion concreta de esa plantilla

repository: es donde se almacenan y distribuyen charts de Helm podemos decir que es como un github
#
3. ¿Qué es un StatefulSet y cuándo NO usarlo?

es un recurso de kubernetes que se utiliza para administrar aplicaciones que necesitan mantener su identidad o sus datos.

en un statefulset cada pod tiene una identidad propia y estable.

no lo debemos utilizar cuando nuestra aplicacion no requiera mantener identidad ni datos propios, es decir, no se debe usar para aplicaciones sin estado

#
4. ¿Cuál es la diferencia entre liveness, readiness y startup probe?

liveness: verifica si el contenedor todavía esta funcionando correctamente (si detecta que tiene fallas lo reinicia)

readiness: verifica si el contenedor esta preparado para atender solicitudes (no reinicia el contenedor)

startup: se utiliza cuando las aplicaciones tardan bastante tiempo en arrancar (da tiempo a la aplicacion para iniciar)


#
5. ¿Qué es una NetworkPolicy y por qué el tráfico es permitido por defecto?

es una regla de kubernetes que permite controlar que pods pueden comunicarse con otros pods o servicios dentro del cluster

funciona tipo como un firewall para la red de los pods

kubernetes permite esta comunicacion debido a que intenta facilitar que las aplicaciones funcionen y puedan comunicarse sin que tengamos que crear reglas de red desde el inicio, si no, nos tocaria ir configurando cada politica desde un inicio haciendo un poco tedioso y tardado el funcionamiento.

#
6. ¿Qué es un PodDisruptionBudget?

un PodDisruptionBudget o PDB es un recurso de kubernetes que sirve para indicar cuantos pods de una aplicacion pueden estar afuera de servicio al mismo tiempo durante una interrupcion planificada

#
7. ¿Qué ventajas y qué nuevos problemas introduce la comunicación asíncrona?

- menor dependencia entre servicios
- mejor capacidad de respuesta
- mejor escalabilidad
- mayor tolencia a fallos

problemas:
- consistencia eventual
- mensajes duplicados
- mensajes fuera de orden
- errores dificiles de rastrear
- manejo de mensajes que fallan

#
8. ¿Qué hace `helm rollback` internamente?

permite volver una aplicacion desplegada con Helm a una version anterior que funcionaba correctamente y vuelve aplicar ese estado sobre kubernetes