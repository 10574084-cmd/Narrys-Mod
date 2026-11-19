# Narry's Mod — Nextbots 3D

Juego de supervivencia en primera persona estilo "nextbots": imágenes de memes que te persiguen por mapas 3D. Corre en el navegador (Three.js), sin instalar nada.

## Jugar
Activa GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / `(root)`**.
El juego quedará en `https://10574084-cmd.github.io/Narrys-Mod/`.

## Características
- Primera persona (teclado + ratón, y controles táctiles en móvil)
- 5 mapas generados proceduralmente: Backrooms, Almacén, Mansión Abandonada, Ciudad Nocturna, Bosque Maldito
- Hasta **30 jugadores CPU** con IA (pathfinding A*, huyen de los nextbots) y **100 nombres aleatorios** (`js/names.js`)
- Nextbots con caras meme (incluidas) y **tus propias imágenes** (botón "Subir imágenes" o carpeta `images/memes/` + `manifest.json`)
- Modelos humanoides 3D articulados, linterna, sombras, niebla, sonido procedural
- Menú con mapa, nº de CPUs, nextbots, dificultad, duración y gráficos
- Calidad "Raytracing (aprox.)": oclusión ambiental, reflejos y sombras suaves (no es path tracing real)

## Controles
WASD mover · Shift correr · Ratón mirar · F linterna · Tab lista de jugadores · Esc pausa

## Memes propios en el repo
Pon imágenes en `images/memes/` y lista sus nombres en `images/memes/manifest.json`, por ejemplo `["gato.png","jefe.jpg"]`.
