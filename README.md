# Narry's Mod — Nextbots 3D

Juego de supervivencia en primera persona estilo "nextbots": imágenes de memes que te persiguen por mapas 3D. Corre en el navegador (Three.js), sin instalar nada.

## Jugar
Activa GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / `(root)`**.
El juego quedará en `https://10574084-cmd.github.io/Narrys-Mod/`.

## Características
- Primera persona (teclado + ratón, y controles táctiles en móvil)
- 22 mapas generados proceduralmente: Backrooms, Almacén, Mansión, Ciudad Nocturna, Bosque, Llanura Plana, Zona de Construcción, Gran Ciudad (Día), Isla Tropical, Minas Profundas, Búnker Militar y Laberinto de Setos, más 10 nuevos: Estación de Metro, Escuela Abandonada, Hospital Abandonado, Supermercado, Estacionamiento, Estación Espacial, Desierto de Ruinas, Tundra Nevada, Cementerio y Feria Abandonada
- Intro con música: créditos (Claude y ms63), 200+ tips de broma aleatorios y, en el drop de la canción, aparece el menú principal
- Hasta **60 jugadores CPU** con IA (pathfinding A*, huyen de los nextbots) y **500 nombres aleatorios** (`js/names.js`)
- Nextbots con caras meme (incluidas) y **tus propias imágenes** (botón "Subir imágenes" o carpeta `images/memes/` + `manifest.json`)
- Modelos humanoides 3D articulados, linterna, sombras, niebla, sonido procedural
- Menú con mapa, nº de CPUs, nextbots, dificultad, duración y gráficos
- Calidad "Raytracing (aprox.)": oclusión ambiental, reflejos y sombras suaves (no es path tracing real)

## Controles
WASD mover · Shift correr · Ratón mirar · F linterna · Tab lista de jugadores · Esc pausa

## Memes propios en el repo
Pon imágenes en `images/memes/` y lista sus nombres en `images/memes/manifest.json`, por ejemplo `["gato.png","jefe.jpg"]`.

## Armas
Hay armas en el suelo (se recogen caminando encima; las ves por el rayo de luz y en el minimapa): **1 bazuca** en todo el mapa y 8 más (5 revólveres y 3 escopetas). Clic izquierdo para disparar. Tienes un **inventario de 6 slots** (uno por arma; teclas **1–6** o rueda del ratón; pulsar el mismo número guarda el arma): recoger otra arma la añade al siguiente slot, y recoger una que ya tienes **suma munición** (hasta 3 veces la carga original). Revólver y escopeta aturden al nextbot unos segundos; la bazuca explota y destierra a los nextbots cercanos lejos de ti.

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
- Hay **22 armas** en el mapa (1 bazuca, 13 revólveres, 8 escopetas) y los CPU esperan **10 s** al iniciar antes de empezar a recoger armas.
- **Tamaño del mapa** en Opciones: Normal (48×48), Grande (64×64) o Enorme (80×80). Al crecer el mapa también aumenta la cantidad de armas.
- **🍫 Odio el chocolate:** al morir aparece un botón extra (solo después de derrotar al jefe ODIO EL CHOCOLATE) que reproduce el video (`assets/odio-el-chocolate.mp4`, no se puede saltar) y te revive con 5 s de protección y los nextbots cercanos desterrados. Solo una vez por partida.

## 🔑 Códigos secretos
En el menú principal hay una sección **Códigos secretos**. El código `odio el chocolate` abre un **Boss Fight**:
- Arena «Backrooms Planos»: sala enorme abierta, sin techo, solo con pilares y muros bajos.
- **ODIO EL CHOCOLATE** es un nextbot gigante (el video del mismo nombre, con su audio) con barra de vida; te persigue aunque no te vea y se enfurece al perder vida.
- Tienes **100 CPUs armados** de aliados; hay 25 armas por el mapa que reaparecen a los 20 s (también las bazucas).
- Tus disparos y los de los CPU le quitan vida (revólver 6, escopeta 14, bazuca 90). Si lo derrotas ganas la ronda.
- Si **pierdes el boss fight**, la pantalla de derrota muestra un botón «TOCA AQUÍ» que abre otra página en una ventana emergente (pop-up).

## 🎯 Mira del arma y 🔓 desbloqueos
- **Apuntar:** mantén el **clic derecho** (en celular, el botón 🎯) para hacer zoom con mira, menos sensibilidad y más precisión al disparar. El arma equipada también muestra una mira en cruz.
- **Al ganar el boss fight** (tú o tus CPUs) se desbloquean, de forma permanente en tu navegador: el nextbot **ODIO EL CHOCOLATE** (aparece en «Memes / nextbots» para usarlo en cualquier mapa) y el mapa **Backrooms Planos** (en «Mapa y partida»).
- **ODIO EL CHOCOLATE como nextbot en cualquier mapa:** una vez desbloqueado, aparece gigante como el jefe, te persigue aunque no lo veas y tiene **barra de vida**. En «Memes / nextbots» tiene un engranaje ⚙ para elegir su **tamaño** (2–40 m) y su **vida** (1 a 10.000.000). Las armas le quitan vida y, al derrotarlo, no vuelve. Puedes poner varios.
- **🤖 Nextbots de IA: SÍ / NO** (en «Memes / nextbots»): con SÍ se usan los nextbots de IA integrados y tus imágenes; con NO solo tus imágenes (y el jefe, si lo desbloqueaste). Los de IA se atenúan cuando están apagados.

## ⚙️ Opciones: rendimiento, extras y controles
- **⚡ Optimizar rendimiento:** un clic pone calidad Baja, resolución 75% con ajuste automático, sombras apagadas, pocas luces y distancia de dibujado media (y baja CPUs a 20 y el mapa a Normal si estaban más altos). «Restablecer» lo deja como estaba.
- **Rendimiento (a mano):** resolución de render (40–100%), sombras, luces dinámicas, distancia de dibujado (los CPU lejanos no se dibujan ni se animan), límite de FPS (30/60), resolución automática y contador de FPS.
- **Extras:** volumen, balanceo de cámara, invertir eje vertical, minimapa / registro de eventos / nombres de CPU, correr y apuntar «alternar», botones del ratón (cambiar disparar/apuntar), sensibilidad, color y tamaño de la mira.
- **Controles:** reasigna avanzar, retroceder, izquierda, derecha, correr, saltar, linterna, revivir, lista de jugadores y las 3 armas. Si repites una tecla se intercambian; Esc cancela. Todo se guarda en el navegador.

## 🔫 Armas (6)
- **Revólver** y **Escopeta** con modelos rehechos (tambor con recámaras, martillo, guardamonte, corredera con estrías, cartuchos...). El arma en primera persona usa un sombreado propio que ya no se quema con la linterna.
- **Subfusil** (automático: mantén el clic; muchas balas, aturde poco), **Francotirador** (zoom enorme con mira telescópica al apuntar, 40 de daño, muy preciso) y **Lanzagranadas** (explosión pequeña que destierra nextbots cercanos, 30 de daño al jefe).
- Los CPU también las usan y las sueltan al morir. Hay ~29 armas por el mapa (1 bazuca, 10 revólveres, 5 subfusiles, 8 escopetas, 3 francotiradores y 3 lanzagranadas), que reaparecen a los 60 s (la bazuca no).

## Código secreto: Sonic1.exe
En «Códigos secretos» escribe `Sonic1.exe`: boss fight en **Green Hills .EXE** (colina verde corrompida con muros a cuadros, palmeras con sangre, flores con un ojo y charcos de sangre) contra **SONIC.EXE, TAILS DOLL y KNUCKLES.EXE** (tamaño de nextbot normal, 5000 de vida cada uno) con 100 CPUs armados de ayuda. Al derrotar a los tres desbloqueas el mapa y los tres nextbots jefes (aparecen en «Memes / nextbots» y «Mapa y partida»). Las imágenes están en `assets/exe/`.

## Logros 🏆
Botón de trofeo en la esquina del menú principal con 44 logros (partidas, victorias, dificultades, mapas, armas, salto, revivir CPUs, opciones…). Los que se consiguen con códigos secretos aparecen como **???** hasta desbloquearlos. Se guardan en el navegador y al conseguir uno sale un aviso arriba.

## Reinicio de fábrica
En Opciones → «Zona peligrosa» hay un botón para borrar todo lo guardado (ajustes, controles, logros, desbloqueos, estadísticas y nextbots subidos). Pide doble confirmación y el juego queda como recién instalado.

## Atajos de jefes
Cuando derrotas a un jefe secreto aparece un atajo en la esquina superior izquierda del menú para pelear contra él otra vez (con confirmación).

## Música de los jefes
Durante el boss fight suena una canción de fondo (en bucle, con el volumen de Opciones): «Odio el chocolate (Chase theme)» contra ODIO EL CHOCOLATE y «EXE FUNK» contra SONIC.EXE y sus amigos (`assets/music/`). Se pausa con el juego y se corta al terminar la ronda.

## Código secreto: Verity
Escribe `Verity` en «Códigos secretos»: boss fight contra **VERITY** (10 000 de vida) en la **Casa de Verity**, una casa de varias habitaciones con suelo de madera, con 55 CPUs armados de ayuda y su canción de fondo (instrumental; las voces suenan solo cuando te acercas a ella, `assets/music/verity-*.mp3`). Al derrotarla desbloqueas el mapa y a Verity como nextbot, y aparece su atajo en el menú.

## Encontrar al jefe
En los boss fights el jefe aparece a ~22 m de ti, se ve siempre en el minimapa (círculo dorado) y bajo su barra de vida hay una flecha ▲ que apunta hacia él con la distancia. Verity es pequeña (2,2 m) y su casa usa un mapa reducido (36×36).

## Derrota contra ODIO EL CHOCOLATE
Si pierdes el boss fight del chocolate, en vez de los botones normales la pantalla queda en negro con el botón **🍫 Odias el chocolate** (revive una vez con el video) y **CLICKEA AQUÍ**, que abre la página de Odio el Troyano (ventana emergente). Reintentar y Menú vuelven al clicar o revivir.

## ??? (jefe final)
Al derrotar a los tres jefes (Odio el chocolate, Sonic.exe y amigos, Verity) aparece el botón **???** en el menú principal. Te hace derrotarlos otra vez seguidos y, al final, aparecen **todos los jefes a la vez** en la **Zona Glitch** (mezcla de todos los mapas, plana y sin techo) con **150 CPUs** y la canción `assets/music/final-zone.mp3`. Da el logro secreto «???».
El jefe final empieza con una intro: miras a los jefes «solo», llegan los 150 CPUs corriendo con bazucas, uno te regala una bazuca y empieza la batalla (todos con bazuca).
