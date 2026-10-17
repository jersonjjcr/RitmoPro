# RitmoPro

Panel de seguimiento de hábitos con Next.js, Firebase Authentication y Cloud Firestore. Cada usuario solo puede acceder a sus propios hábitos.

## Requisitos

- Node.js 20 o superior.
- Un proyecto de Firebase con Authentication y Cloud Firestore habilitados.

## Configuración local

1. Instala dependencias con `npm install`.
2. Copia `.env.local.example` como `.env.local` y completa los valores de configuración de tu aplicación web Firebase.
3. En Firebase Console, habilita **Authentication > Sign-in method > Google**.
4. En **Authentication > Settings > Authorized domains**, agrega `localhost` y el dominio donde publiques la aplicación.
5. Crea la base de datos de Cloud Firestore y publica el contenido de `firestore.rules` desde la pestaña **Rules**.
6. Ejecuta `npm run dev` y abre `http://localhost:3000`.

Las variables `NEXT_PUBLIC_FIREBASE_*` son la configuración pública del cliente Firebase, no claves de servicio. No agregues credenciales de cuenta de servicio al navegador ni al repositorio.

## Datos

Los hábitos se guardan en `users/{uid}/habits/{habitId}`. Las reglas de Firestore comparan el UID autenticado con el identificador del documento padre para proteger las lecturas y escrituras. Las modificaciones se sincronizan en tiempo real entre sesiones del mismo usuario.

El HTML independiente original se conserva como referencia en `panel_interactivo_de_seguimiento_de_h_bitos.html`.