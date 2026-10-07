# Responsys 1.0A: tema oscuro y pantalla sin desplazamiento

Se mantiene el snapshot de 32.804 registros, hash `1ff90bb8129c2372`, y las fórmulas existentes. El cambio afecta presentación y tamaño de las páginas; no altera el origen, los conteos ni las exportaciones completas.

- Tema oscuro ETB con azul profundo, cian, texto claro y glass; modo claro conservado. Preferencia del sistema en primera visita y elección guardada en el navegador.
- Altura del tablero limitada al viewport dinámico. No hay contenedores con desplazamiento automático. El espacio disponible determina cuántas filas se consultan por página.
- Cinco KPIs persistentes. En pantallas compactas se abre una gráfica a la vez: evolución, actividad, ranking, folders y propósitos. Envíos utiliza notación compacta móvil; el valor íntegro y los conteos auxiliares siguen disponibles en las definiciones.
- Actividad muestra tasas sobre envíos; aperturas, clics, entrega y rebotes no son categorías excluyentes. Distribuciones muestran segmentos y porcentajes. El ranking añade barras proporcionales al líder y páginas cuando no caben las cinco campañas.
- Filtros en cuatro pestañas, tablas compactas con ordenamiento por métrica y detalle individual del registro. Escape cierra solo el panel superior y devuelve el foco al panel de origen.

## Verificación

Las tres vistas se revisaron en 1366×768, 1920×1080, 390×844, 320×568, 844×390 y 683×384. Se comprobaron límites de controles, dimensiones de tablas y que la tecla End no desplazara el documento. Las cinco pestañas de gráficos se revisaron también en 320×568. Los recortes detectados en Calidad con poca altura se corrigieron agrupando controles y trasladando filtros al encabezado.

La prueba de paginación adaptable recorre todas las campañas y registros con páginas de 1, 3, 7 y 25 filas. Comprueba conteos, ausencia de pérdidas y exportación completa. Las pruebas del motor mantienen paridad con el resumen Python y verifican períodos, comparaciones, anomalías, filtros, CSV y hashes.

Las capturas del modo oscuro se guardan en `docs/assets/responsys-dark-desktop.jpg` y `docs/assets/responsys-dark-mobile.jpg`.
