// Perú no usa horario de verano: un offset fijo UTC-5 es seguro todo el año. `fecha` en
// las tablas se guarda con new Date().toISOString() (UTC), y el 'now' de SQLite también
// es UTC — sin este offset, el corte de "día" quedaba 5 horas antes de la medianoche
// real en Lima, así que una venta hecha entre las 7pm y medianoche se contaba en el
// día siguiente.
export const OFFSET_LIMA = '-5 hours';

// Inverso de OFFSET_LIMA: para calcular un límite tipo "inicio del año en hora Lima" sin
// envolver la columna `fecha` en una función (y así seguir usando el índice), se arma el
// límite completo en UTC: 'now' → restar 5h (llevar a hora Lima) → truncar → sumar 5h
// (volver a UTC). Ese último paso usa este offset.
export const OFFSET_LIMA_INVERSO = '+5 hours';
