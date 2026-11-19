# Narry's Mod — Nextbots 3D

Juego de supervivencia en primera persona estilo "nextbots": imágenes de memes que te persiguen por mapas 3D. Corre en el navegador (Three.js), sin instalar nada.

## Jugar
Activa GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / `(root)`**.
El juego quedará en `https://10574084-cmd.github.io/Narrys-Mod/`.

## Características
- Primera persona (teclado + ratón, y controles táctiles en móvil)
- 12 mapas generados proceduralmente: Backrooms, Almacén, Mansión, Ciudad Nocturna, Bosque, Llanura Plana, Zona de Construcción, Gran Ciudad (Día), Isla Tropical, Minas Profundas, Búnker Militar y Laberinto de Setos
- Hasta **30 jugadores CPU** con IA (pathfinding A*, huyen de los nextbots) y **500 nombres aleatorios** (`js/names.js`)
- Nextbots con caras meme (incluidas) y **tus propias imágenes** (botón "Subir imágenes" o carpeta `images/memes/` + `manifest.json`)
- Modelos humanoides 3D articulados, linterna, sombras, niebla, sonido procedural
- Menú con mapa, nº de CPUs, nextbots, dificultad, duración y gráficos
- Calidad "Raytracing (aprox.)": oclusión ambiental, reflejos y sombras suaves (no es path tracing real)

## Controles
WASD mover · Shift correr · Ratón mirar · F linterna · Tab lista de jugadores · Esc pausa

## Memes propios en el repo
Pon imágenes en `images/memes/` y lista sus nombres en `images/memes/manifest.json`, por ejemplo `["gato.png","jefe.jpg"]`.

## Armas
Hay armas en el suelo (se recogen caminando encima; las ves por el rayo de luz y en el minimapa): **1 bazuca** en todo el mapa y 8 más (5 revólveres y 3 escopetas). Clic izquierdo para disparar. Revólver y escopeta aturden al nextbot unos segundos; la bazuca explota y destierra a los nextbots cercanos lejos de ti.

## Menú principal
El fondo del menú es una escena 3D en vivo: humanoides corriendo y nextbots persiguiéndolos, con un nextbot gigante al fondo. El entorno cambia según el mapa que elijas (hay un selector rápido de mapas bajo el botón INICIAR).

## IA de los nextbots
Los nextbots ya no saben dónde estás: **solo te persiguen cuando te ven** (distancia, línea de visión y campo de visión de ~150° mientras patrullan; alcance 30–45 m según dificultad). Si te pierden, van al último sitio donde te vieron, buscan unos segundos y **se rinden** y vuelven a patrullar. Los nextbots no se avisan entre sí.
