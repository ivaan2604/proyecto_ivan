// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  CONTENIDO DEL REGALO                                                     ║
// ║                                                                           ║
// ║  Este es el ÚNICO archivo que necesitas editar. Aquí están todos los      ║
// ║  textos, preguntas, respuestas, fotos, pistas, la palabra final y el      ║
// ║  regalo. El código no contiene nada personal.                             ║
// ║                                                                           ║
// ║  Reglas rápidas:                                                          ║
// ║  · Los textos van entre comillas "…". Si dentro necesitas comillas,       ║
// ║    usa las tipográficas “así” o comillas simples 'así'.                   ║
// ║  · No olvides la coma al final de cada línea dentro de { } y [ ].         ║
// ║  · FOTOS: escribe el nombre del archivo tal cual lo dejaste en ./fotos    ║
// ║    (p. ej. "playa-2022.jpg") y ejecuta `npm run fotos`. Las fotos         ║
// ║    "ejemplo-N.jpg" son de muestra: cámbialas por las vuestras.            ║
// ║  · Con `npm run dev` abierto, al guardar se recarga solo; si algo está    ║
// ║    mal, verás un aviso rojo arriba explicando qué.                        ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/** @type {import('../src/tipos.js').Config} */
export default {
  // ─────────────────────────────────────────────────────────────────────────
  // VOSOTROS
  // ─────────────────────────────────────────────────────────────────────────
  ella: "Lucía", // Su nombre, tal y como quieres que aparezca
  yo: "Iván", // Tu nombre (firma de la carta y de algunos mensajes)

  // URL definitiva donde estará publicada la web (la usa el script de QR).
  // Déjala así hasta que la publiques en Vercel/Netlify y luego cámbiala.
  urlPublica: "https://regalo-ejemplo.vercel.app/",

  // "lineal": los niveles se juegan en orden (cada uno desbloquea el siguiente).
  // "tesoro": cada nivel solo aparece al escanear su tarjeta QR escondida.
  modo: "lineal",

  // Animación de la revelación final: "caja" (caja 3D con lazo)
  // o "sobre" (sobre con sello de lacre). Para verlas sin jugar:
  //   http://localhost:5173/?demo=caja   y   http://localhost:5173/?demo=sobre
  revelacion: "caja",

  // ─────────────────────────────────────────────────────────────────────────
  // PANTALLA DE ENTRADA + CONTRASEÑA
  // ─────────────────────────────────────────────────────────────────────────
  entrada: {
    titulo: "Feliz Navidad, Lucía",
    emoji: "🎄",
    texto:
      "Este año tu regalo no está debajo del árbol. Está escondido aquí dentro… y te lo vas a tener que ganar.",
    boton: "Empezar",

    // La "contraseña": solo es un juego, no es seguridad real.
    pregunta: "Para entrar: ¿qué día empezó lo nuestro?",
    // "fecha" muestra un selector de fecha · "texto" muestra un campo libre
    tipo: "fecha",
    // Respuestas válidas. Para tipo "fecha" usa el formato AAAA-MM-DD.
    // Para tipo "texto" no importan mayúsculas, tildes ni espacios.
    respuestas: ["2025-08-11"], // 11 de agosto de 2025: nuestro aniversario

    // Se muestran por orden (y luego en bucle) cada vez que falla
    mensajesFallo: [
      "Mmm… no. ¿Seguro que eres tú? 🤨",
      "Error 404: romanticismo no encontrado.",
      "Voy a hacer como que no he visto eso.",
      "Te doy otra oportunidad porque te quiero.",
    ],
    fallosParaPista: 2, // tras estos fallos aparece la pista
    pista: "Pista: es nuestro aniversario 💛 Un lunes de agosto, en pleno verano ☀️",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PALABRA SECRETA FINAL
  // Cada nivel da una o varias letras (campo `recompensa.letras`). Entre todos
  // deben sumar EXACTAMENTE las letras de esta palabra (en cualquier orden:
  // la gracia es que al final tenga que ordenarlas). Sin tildes ni espacios.
  // ─────────────────────────────────────────────────────────────────────────
  palabraFinal: "BURBUJAS",
  candado: {
    titulo: "El último candado",
    texto:
      "Tienes todas las letras. Ordénalas para formar la palabra secreta y abrir tu regalo.",
    mensajesFallo: [
      "Casi… pero no. Prueba otro orden.",
      "Esa palabra no existe (o no es la mía).",
    ],
    fallosParaPista: 2,
    // Tras la pista se colocan solas las primeras letras correctas
    pista: "Piensa en algo que hace “blup blup”… 🫧",
    letrasReveladasConPista: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // NIVELES
  // Se juegan en el orden en que aparecen. Puedes reordenarlos, quitar o
  // duplicar tipos. Tipos disponibles: "quiz", "memory", "donde", "rasca",
  // "puzzle". Cada nivel tiene:
  //   id         → identificador único sin espacios (no lo cambies una vez
  //                que ella haya empezado a jugar, o perderá ese progreso)
  //   token      → código para el QR propio del nivel (?n=token). Cualquier
  //                texto difícil de adivinar.
  //   titulo, emoji, intro → presentación del nivel
  //   ayuda      → { tras: nº de fallos, texto: pista }   (opcional)
  //   datos      → depende del tipo (ver cada ejemplo)
//   textoTarjeta → (opcional) frase de su tarjeta impresa, para la búsqueda
//                del tesoro. P. ej. "La siguiente está donde guardas los calcetines 🧦"
  //   recompensa → lo que desbloquea:
  //       foto, fecha, frase  → el recuerdo (polaroid)
  //       pista               → pista sobre el regalo (sin revelarlo)
  //       letras              → letra(s) de la palabra final
  // ─────────────────────────────────────────────────────────────────────────
  niveles: [
    // ── NIVEL 1 · QUIZ ────────────────────────────────────────────────────
    {
      id: "quiz-calentamiento",
      token: "k7f2q",
      tipo: "quiz",
      titulo: "Calentando motores",
      emoji: "💬",
      intro: "Unas preguntas fáciles para ver cuánto me conoces. Fáciles… en teoría.",
      ayuda: { tras: 2, texto: "Te quito un par de opciones para que no sufras." },
      datos: {
        preguntas: [
          {
            pregunta: "¿Dónde fue nuestra primera cita?",
            opciones: ["En el cine", "En una terraza", "En un bar de tapas", "En el parque"],
            correcta: 2, // posición de la correcta empezando a contar en 0
            siFalla: "¿Cómo que no te acuerdas? Yo estaba nerviosísimo.",
            siAcierta: "¡Eso es! Y pediste las bravas más picantes de la carta.",
          },
          {
            pregunta: "¿Qué es lo que más me cuesta por las mañanas?",
            opciones: ["Levantarme", "Elegir ropa", "Hablar antes del café", "Todo lo anterior"],
            correcta: 3,
            siFalla: "Casi. Pero la respuesta es más… completa.",
            siAcierta: "Me conoces demasiado bien.",
          },
          {
            pregunta: "¿Qué canción es “nuestra”?",
            opciones: ["Canción de ejemplo A", "Canción de ejemplo B", "Canción de ejemplo C"],
            correcta: 0,
            siFalla: "Te la voy a poner en bucle hasta que te la aprendas.",
            siAcierta: "Ya la estás tarareando, lo sé.",
          },
        ],
      },
      recompensa: {
        foto: "ejemplo-1.jpg",
        fecha: "11 de agosto de 2025",
        frase: "El día que empezó todo.",
        pista: "Tu regalo no se puede envolver.",
        letras: "J",
      },
    },

    // ── NIVEL 2 · MEMORY ──────────────────────────────────────────────────
    {
      id: "memory-fotos",
      token: "p3m9x",
      tipo: "memory",
      titulo: "Memoria de pez",
      emoji: "🧠",
      intro: "Encuentra las parejas. Son todas nuestras, así que no tienes excusa.",
      datos: {
        // Exactamente 6 fotos → 12 cartas (rejilla de 3×4, ideal en móvil).
        // Puedes poner 4, 6 u 8.
        fotos: ["ejemplo-1.jpg", "ejemplo-2.jpg", "ejemplo-3.jpg", "ejemplo-4.jpg", "ejemplo-5.jpg", "ejemplo-6.jpg"],
        // Comentario final según cuántos intentos haya necesitado
        comentarios: [
          { hasta: 9, texto: "¿Has hecho trampa? Porque eso ha sido perfecto." },
          { hasta: 14, texto: "Muy bien. Memoria de elefante (de los guapos)." },
          { hasta: 999, texto: "Lo importante es participar. Y lo has conseguido 😄" },
        ],
      },
      recompensa: {
        foto: "ejemplo-2.jpg",
        fecha: "Verano 2021",
        frase: "Nuestro primer viaje: tú con el mapa, yo perdiéndome igual.",
        pista: "Lo disfrutaremos juntos.",
        letras: "UB",
      },
    },

    // ── NIVEL 3 · ¿DÓNDE ESTÁBAMOS? ───────────────────────────────────────
    {
      id: "donde-estabamos",
      token: "w8d4r",
      tipo: "donde",
      titulo: "¿Dónde estábamos?",
      emoji: "📍",
      intro: "La foto está borrosa. Cada vez que falles se verá un poco mejor.",
      ayuda: { tras: 3, texto: "Hacía muchísimo calor y comimos helado de turrón." },
      datos: {
        foto: "ejemplo-3.jpg",
        pregunta: "¿Dónde se hizo esta foto?",
        // Respuestas válidas si escribe (sin importar mayúsculas ni tildes).
        // Basta con que lo que escriba CONTENGA una de ellas.
        respuestas: ["alicante", "playa de san juan"],
        // Si pones opciones, se muestran botones en vez de un campo de texto
        // (la correcta debe estar también en `respuestas`).
        opciones: ["Valencia", "Alicante", "Málaga", "Gijón"],
        // Mensajes cuando falla (se van rotando)
        mensajesFallo: ["Frío, frío…", "Nop. Mira bien ese cielo.", "¡Que estuviste tú!"],
      },
      recompensa: {
        foto: "ejemplo-3.jpg",
        fecha: "Agosto 2022",
        frase: "Aquí me dijiste que nunca te habías reído tanto.",
        pista: "Necesitarás algo que normalmente es de verano.",
        letras: "S",
      },
    },

    // ── NIVEL 4 · RASCA Y GANA ────────────────────────────────────────────
    {
      id: "rasca",
      token: "z5c1v",
      tipo: "rasca",
      titulo: "Rasca y gana",
      emoji: "🪙",
      intro: "Rasca con el dedo. Sí, como en los de la lotería, pero aquí siempre toca.",
      datos: {
        portada: "Rasca aquí ✨",
        mensaje: "Has ganado… un abrazo de los largos, canjeable en cualquier momento. Sin fecha de caducidad.",
        umbral: 0.55, // fracción rascada (0–1) para darlo por descubierto
      },
      recompensa: {
        foto: "ejemplo-4.jpg",
        fecha: "Navidad 2022",
        frase: "Nuestra primera Navidad juntos. Mi jersey era horrible y lo sabes.",
        pista: "Hay agua de por medio (y no, no es un barco).",
        letras: "R",
      },
    },

    // ── NIVEL 5 · PUZZLE DESLIZANTE ───────────────────────────────────────
    {
      id: "puzzle",
      token: "h2t6y",
      tipo: "puzzle",
      titulo: "Piezas sueltas",
      emoji: "🧩",
      intro: "Toca una pieza junto al hueco para moverla. Recompón la foto.",
      ayuda: { tras: 150, texto: "Si te atascas, puedes ver la foto completa." },
      datos: {
        foto: "ejemplo-5.jpg",
        tamano: 3, // 3 = 3×3 (8 piezas). 4 = 4×4 es bastante más difícil.
        // Tras estos segundos aparece el botón "Resuélvelo tú"
        segundosParaRendirse: 150,
      },
      recompensa: {
        foto: "ejemplo-5.jpg",
        fecha: "Primavera 2023",
        frase: "Encajamos. Como estas piezas, pero con menos esfuerzo.",
        pista: "Es para relajarse. Mucho.",
        letras: "BU",
      },
    },

    // ── NIVEL 6 · QUIZ FINAL ──────────────────────────────────────────────
    {
      id: "quiz-final",
      token: "m9b3n",
      tipo: "quiz",
      titulo: "El jefe final",
      emoji: "👑",
      intro: "Último nivel. Aquí ya no hay preguntas fáciles.",
      ayuda: { tras: 2, texto: "Venga, te ayudo un poco." },
      datos: {
        preguntas: [
          {
            pregunta: "¿Cuál fue la primera película que vimos juntos?",
            opciones: ["Película A", "Película B", "Película C", "Película D"],
            correcta: 1,
            siFalla: "Te dormiste a la mitad, así que tiene un pase.",
            siAcierta: "Bien. Aunque te dormiste a la mitad.",
          },
          {
            pregunta: "¿Qué es lo que más me gusta de ti?",
            opciones: ["Tu risa", "Cómo me miras", "Que me aguantas", "Todo, obviamente"],
            correcta: 3,
            siFalla: "Respuesta válida, pero incompleta.",
            siAcierta: "Pregunta trampa: era imposible elegir.",
          },
        ],
      },
      recompensa: {
        foto: "ejemplo-6.jpg",
        fecha: "Hoy",
        frase: "Y lo que nos queda.",
        pista: "Necesitarás bañador. Ups, eso era casi decírtelo.",
        letras: "A",
      },
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // EL REGALO (se ve después de abrir la caja/sobre)
  // ─────────────────────────────────────────────────────────────────────────
  regalo: {
    emoji: "♨️",
    nombre: "Tarde de spa para los dos",
    subtitulo: "Circuito termal de 3 horas en Thermas de Griñón",
    descripcion:
      "Tres horas de piscinas, burbujas y cero prisas. Sin móviles, sin planes, sin despertador. Solo tú, yo y un albornoz.",
    incluye: [
      "Circuito termal de 3 horas",
      "Piscinas de contraste, jacuzzi y sauna",
      "Infusión y fruta al terminar",
      "Toalla, albornoz y zapatillas",
    ],
    lugar: {
      nombre: "Thermas de Griñón",
      direccion: "Calle Ejemplo, 1, 28971 Griñón, Madrid",
      // Lo que se busca en Google Maps (nombre + ciudad suele bastar).
      // Si prefieres un enlace exacto, pon `enlaceMaps: "https://maps.app.goo.gl/…"`
      busquedaMaps: "Thermas de Griñón",
    },
    llevar: ["Bañador", "Gorro de piscina", "Chanclas", "Ganas de no hacer nada"],
    reserva: {
      texto: "Se reserva por teléfono o en su web con el código del bono. Elegimos juntos el día.",
      // Opcional: enlace a la web de reservas (deja "" si no hay)
      enlace: "",
      codigo: "XMAS-2026-EJEMPLO", // opcional: código del bono
    },
    whatsapp: {
      // Tu número con prefijo de país, solo dígitos (34 = España)
      telefono: "34600000000",
      boton: "¿Cuándo vamos? 💬",
      mensaje: "¡He abierto mi regalo! 🎁 ¿Cuándo nos vamos al spa? Yo propongo…",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CARTA DE CIERRE
  // ─────────────────────────────────────────────────────────────────────────
  cierre: {
    titulo: "Una última cosa…",
    // Cada elemento es un párrafo
    carta: [
      "Lucía:",
      "Si has llegado hasta aquí es que has superado todas las pruebas (con o sin ayuda, no voy a preguntar).",
      "Quería que este regalo fuera algo más que un sobre: quería que recordáramos un poco todo lo que llevamos juntos. Y que te rieras, aunque fuera de mis preguntas.",
      "Gracias por cada día. Por los buenos y por los de lluvia.",
      "Feliz Navidad. Te quiero.",
    ],
    firma: "Iván",
  },
};
