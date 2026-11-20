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
Hay armas en el suelo (se recogen caminando encima; las ves por el rayo de luz y en el minimapa): **1 bazuca** en todo el mapa y 8 más (5 revólveres y 3 escopetas). Clic izquierdo para disparar. Tienes un **inventario de 3 slots** (teclas **1, 2, 3** o rueda del ratón; pulsar el mismo número guarda el arma): recoger otra arma la añade al siguiente slot, y recoger una que ya tienes **suma munición** (hasta 3 veces la carga original). Revólver y escopeta aturden al nextbot unos segundos; la bazuca explota y destierra a los nextbots cercanos lejos de ti.

## Menú principal
El fondo del menú es una escena 3D en vivo: humanoides corriendo y nextbots persiguiéndolos, con un nextbot gigante al fondo. El entorno cambia según el mapa que elijas (hay un selector rápido de mapas bajo el botón INICIAR).

## IA de los nextbots
Los nextbots ya no saben dónde estás: **solo te persiguen cuando te ven** (distancia, línea de visión y campo de visión de ~150° mientras patrullan; alcance 30–45 m según dificultad). Si te pierden, van al último sitio donde te vieron, buscan unos segundos y **se rinden** y vuelven a patrullar. Los nextbots no se avisan entre sí.

## Reaparición de armas y CPUs con armas
- Las armas recogidas (por ti o por un CPU) **reaparecen a los 60 s** en otro punto del mapa. La **bazuca no reaparece**.
- Los CPU buscan y recogen armas cuando no hay nextbots cerca; con munición se plantan a disparar (revólver, escopeta o bazuca) en vez de dejarse atrapar. Huyen mejor: evitan correr hacia los nextbots, prefieren esconderse fuera de su vista, corren a tope solo si el peligro está cerca y evitan pasear por zonas con nextbots.
- Si un CPU muere con un arma cargada, **la suelta junto a su cuerpo** (con la munición que le quedaba, no reaparece) y tú u otro CPU pueden recogerla.
- Corregido: los CPU armados ahora sí disparan y aturden a los nextbots (antes un fallo les impedía defenderse).

## Revivir CPUs
Acércate al cuerpo de un CPU caído (los ves como puntos verdes en el minimapa) y **mantén E** durante 2.5 s (en celular, el botón 💚). Se levanta con 3 s de protección para escapar, pero sin arma. Si te alejas o sueltas la tecla, el progreso baja.
