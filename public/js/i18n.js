/* English and Spanish for everything on screen except the block words,
   which stay English because they are the code (as in every 0.2 game).
   t('Save') → 'Guardar' when the page is in Spanish. {n} fills in. */
window.I18N = (function(){
  const ES = {
    'Front of picture':'Frente del dibujo', 'Up':'Arriba', 'Right':'Derecha', 'Down':'Abajo', 'Left':'Izquierda', 'Point the red arrow where your picture faces.':'Pon la flecha roja hacia donde mira tu dibujo.',
    'Game design':'Diseño de juego', 'Learn':'Aprende', 'Paint':'Pintar', 'Paint a sprite':'Pinta un objeto', 'Paint a costume':'Pinta un disfraz', 'Paint a backdrop':'Pinta un fondo',
    'Brush':'Pincel', 'Eraser':'Borrador', 'Line':'Línea', 'Rectangle':'Rectángulo', 'Circle':'Círculo', 'Fill':'Rellenar', 'Text':'Texto',
    'Pick a colour':'Tomar color', 'More colours':'Más colores', 'Outline':'Borde', 'Filled':'Relleno', 'Clear':'Borrar todo',
    'Close without saving?':'¿Cerrar sin guardar?', 'Close':'Cerrar', 'Centre':'Centro', 'Tour':'Recorrido', 'skipped':'saltado', 'Download script':'Descargar código', 'Save the code of every sprite as one PDF, to hand in':'Guarda el código de todos los objetos en un PDF para entregarlo',
    'Block code':'Código de bloques', 'Student:':'Estudiante:', 'Username:':'Usuario:', 'Period:':'Período:', 'Date:':'Fecha:',
    '(no blocks yet)':'(aún no hay bloques)',
    'All my projects':'Todos mis proyectos', 'Dashboard':'Panel', 'Teachers':'Maestros', 'Student':'Estudiante', 'Worked this week':'Trabajaron esta semana',
    'Blocks (average)':'Bloques (promedio)', 'Blocks':'Bloques', 'This week':'Esta semana', 'Last login':'Última entrada',
    'never':'nunca', 'off':'apagado', 'Turn on':'Activar', 'Turn off':'Desactivar', 'Add':'Añadir', 'Copy':'Copiar',
    'Turn off {n}? They will not be able to log in. Nothing is deleted.':'¿Desactivar a {n}? No podrá entrar. No se borra nada.',
    'First and last name':'Nombre y apellido', 'Write it down — it is not shown again.':'Anótalo — no se vuelve a mostrar.',
    'At least 4 letters.':'Al menos 4 letras.', 'Edit this project':'Editar este proyecto', 'Done':'Listo',
    "Editing {n}'s project — changes save to their account. Their work from before is kept in History.":'Editando el proyecto de {n} — los cambios se guardan en su cuenta. Su trabajo anterior queda en el Historial.',
    'Motion':'Movimiento', 'Looks':'Apariencia', 'Sound':'Sonido', 'Events':'Eventos', 'Control':'Control',
    'Sensing':'Sensores', 'Operators':'Operadores', 'Variables':'Variables', 'Lists':'Listas', 'My Blocks':'Mis bloques',
    'Username':'Usuario', 'Password':'Contraseña', 'Log in':'Entrar', 'Log out':'Salir',
    'Wrong username or password.':'Usuario o contraseña incorrectos.',
    'Too many tries. Wait a few minutes.':'Demasiados intentos. Espera unos minutos.',
    'Could not reach the server.':'No se pudo conectar con el servidor.',
    'My Projects':'Mis proyectos', 'New project':'Proyecto nuevo', 'New':'Nuevo', 'Open':'Abrir',
    'Rename':'Renombrar', 'Duplicate':'Duplicar', 'Delete':'Borrar', 'Restore':'Restaurar',
    'Untitled':'Sin título', 'Saved':'Guardado', 'Saving…':'Guardando…', 'Not saved yet':'Aún no guardado',
    'Offline — kept on this computer':'Sin conexión — guardado en esta computadora',
    'Read only':'Solo lectura', 'History':'Historial', 'Save now':'Guardar ahora',
    'Go back to this version':'Volver a esta versión', 'Versions are saved as you work.':'Las versiones se guardan mientras trabajas.',
    'Restore this version? Your current work is kept in the history too.':'¿Volver a esta versión? Tu trabajo actual también queda en el historial.',
    'just now':'ahora', '{n} min ago':'hace {n} min', '{n} h ago':'hace {n} h', 'yesterday':'ayer',
    'Code':'Código', 'Costumes':'Disfraces', 'Backdrops':'Fondos', 'Sounds':'Sonidos',
    'Sprite':'Objeto', 'Stage':'Escenario', 'Show':'Mostrar', 'Size':'Tamaño', 'Direction':'Dirección',
    'Upload':'Subir', 'Library':'Biblioteca', 'Record':'Grabar', 'Stop':'Parar', 'Play':'Tocar',
    'Choose a Sprite':'Elegir un objeto', 'Upload Sprite':'Subir objeto', 'Choose a Backdrop':'Elegir un fondo',
    'Upload a picture':'Sube una imagen', 'Upload a sound':'Sube un sonido',
    'PNG with a see-through background works best.':'Lo mejor es PNG con fondo transparente.',
    'Remove background':'Quitar fondo', 'Flip':'Voltear', 'Name':'Nombre',
    'This picture has a solid background.':'Esta imagen tiene fondo sólido.',
    'Drop pictures here':'Suelta imágenes aquí', 'Drop sounds here':'Suelta sonidos aquí',
    'That file is not a picture this browser can open.':'Ese archivo no es una imagen que este navegador pueda abrir.',
    'That file is not a sound this browser can play.':'Ese archivo no es un sonido que este navegador pueda tocar.',
    'File too big.':'Archivo demasiado grande.', 'Uploading…':'Subiendo…',
    'Make a Variable':'Crear una variable', 'Make a List':'Crear una lista', 'Make a Block':'Crear un bloque',
    'New variable name:':'Nombre de la nueva variable:', 'New list name:':'Nombre de la nueva lista:',
    'For all sprites':'Para todos los objetos', 'For this sprite only':'Solo para este objeto',
    'New message':'Nuevo mensaje', 'New message name:':'Nombre del nuevo mensaje:',
    'Add Extension':'Añadir extensión', 'Pen':'Lápiz', 'Music':'Música', 'Text to Speech':'Texto a voz',
    'Draw with your sprites.':'Dibuja con tus objetos.', 'Play notes and drums.':'Toca notas y tambores.',
    'Make your projects talk.':'Haz que tus proyectos hablen.',
    'Delete Block':'Borrar bloque', 'Clean up blocks':'Ordenar bloques', 'Undo':'Deshacer', 'Redo':'Rehacer',
    'Help':'Ayuda', 'Rename variable':'Renombrar variable', 'Delete the "{n}" variable':'Borrar la variable "{n}"',
    'Rename list':'Renombrar lista', 'Delete the "{n}" list':'Borrar la lista "{n}"', 'Edit':'Editar',
    'Block name':'Nombre del bloque', 'Add an input (number or text)':'Añadir entrada (número o texto)',
    'Add an input (boolean)':'Añadir entrada (booleana)', 'Add a label':'Añadir texto',
    'Run without screen refresh':'Correr sin refrescar pantalla', 'Cancel':'Cancelar', 'OK':'Aceptar',
    'Download to your computer':'Descargar a tu computadora', 'Load from your computer':'Cargar desde tu computadora',
    'Delete this project?':'¿Borrar este proyecto?', 'Recently deleted':'Borrados recientemente',
    'Students':'Estudiantes', 'Teacher':'Maestro', 'Period':'Período', 'Projects':'Proyectos', 'Last saved':'Último guardado',
    'Block Helper tip':'Consejo para el Ayudante', 'Hints for this student. They see it when they open Block Helper.':'Pistas para este estudiante. Las ve al abrir el Ayudante de bloques.', 'Leave it empty to remove the tip.':'Déjalo vacío para quitar el consejo.',
    'New password':'Nueva contraseña', 'Reset password':'Cambiar contraseña', 'Password changed.':'Contraseña cambiada.',
    'Viewing {n}\'s project':'Viendo el proyecto de {n}', 'Back':'Atrás', 'Full screen':'Pantalla completa',
    'Delete this sprite?':'¿Borrar este objeto?', 'export':'exportar', 'Allow the microphone to record.':'Permite el micrófono para grabar.',
    'Recording…':'Grabando…', 'Nothing here yet. Press New project!':'Aún no hay nada. ¡Presiona Proyecto nuevo!',
    'Undo delete':'Deshacer borrado', 'Drag blocks here':'Arrastra bloques aquí', 'Loading…':'Cargando…',
    'Something went wrong loading this project.':'Algo salió mal al cargar este proyecto.',
    'Zoom in':'Acercar', 'Zoom out':'Alejar', 'Reset zoom':'Zoom normal', 'Small stage':'Escenario pequeño',
    'Stop all':'Parar todo', 'Go':'Ir', 'Choose':'Elegir', 'Search':'Buscar', 'All':'Todo', 'Sprites':'Objetos',
    'empty':'vacío', 'length':'longitud', 'sprite name':'nombre del objeto', 'costume':'disfraz', 'backdrop':'fondo',
    'Picture is still uploading.':'La imagen aún se está subiendo.', 'Load this file? It replaces the project you have open.':'¿Cargar este archivo? Reemplaza el proyecto abierto.'
  };
  let lang = 'en';
  try { lang = localStorage.getItem('cs-lang') || (navigator.language || '').slice(0, 2) === 'es' && 'es' || 'en'; } catch(e){}
  function t(s, vars){
    let out = (lang === 'es' && ES[s]) || s;
    if(vars) out = out.replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? vars[k] : m);
    return out;
  }
  function set(l){ lang = l; try { localStorage.setItem('cs-lang', l); } catch(e){} document.documentElement.lang = l; }
  document.documentElement.lang = lang;
  return { t, set, get lang(){ return lang; } };
})();
window.t = I18N.t;
