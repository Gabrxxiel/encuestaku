const { isValidSession } = require('./_auth');
const { parseCSV, avg } = require('./_lib');

const DIMENSIONES = [
  { key: 'satisfaccion', label: 'Satisfacción General' },
  { key: 'tiempo', label: 'Tiempo de Respuesta' },
  { key: 'calidad', label: 'Calidad de la Solución' },
  { key: 'capacitacion', label: 'Capacitación' },
];

function comentariosDe(r) {
  return [r.comentSat, r.comentTiempo, r.comentCalidad, r.comentCapacitacion, r.comentFinal].filter(Boolean);
}

module.exports = async (req, res) => {
  if (!isValidSession(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'No autorizado' }));
    return;
  }

  try {
    const csvRes = await fetch(process.env.SHEET_CSV_URL);
    if (!csvRes.ok) throw new Error(`No se pudo leer el Sheet (status ${csvRes.status})`);
    const text = await csvRes.text();
    const rows = parseCSV(text);

    const data = rows
      .map(r => ({
        fecha: r[0] || '', marca: r[1] || '', keyUser: r[2] || '', canal: r[3] || '', rol: r[4] || '',
        satisfaccion: Number(r[5]), comentSat: r[6] || '',
        tiempo: Number(r[7]), comentTiempo: r[8] || '',
        calidad: Number(r[9]), comentCalidad: r[10] || '',
        capacitacion: Number(r[11]), comentCapacitacion: r[12] || '',
        promedio: Number(r[13]), comentFinal: r[14] || '',
      }))
      .filter(r => r.marca && !Number.isNaN(r.satisfaccion) && r.satisfaccion > 0);

    const total = data.length;

    const resumenGeneral = {
      totalRespuestas: total,
      promedioGeneral: avg(data.map(d => d.promedio)),
      promedioSatisfaccion: avg(data.map(d => d.satisfaccion)),
      promedioTiempo: avg(data.map(d => d.tiempo)),
      promedioCalidad: avg(data.map(d => d.calidad)),
      promedioCapacitacion: avg(data.map(d => d.capacitacion)),
      pctSatisfechos: total ? data.filter(d => d.promedio >= 4).length / total : 0,
      pctInsatisfechos: total ? data.filter(d => d.promedio < 3).length / total : 0,
    };

    const puntosDeDolor = {
      porDimension: DIMENSIONES.map(d => ({
        dimension: d.label,
        bajos: data.filter(r => r[d.key] <= 3).length,
      })).sort((a, b) => b.bajos - a.bajos),
      casos: data
        .filter(r => r.promedio < 3 || DIMENSIONES.some(d => r[d.key] <= 2))
        .map(r => ({
          marca: r.marca, keyUser: r.keyUser, canal: r.canal, rol: r.rol,
          promedio: r.promedio, comentarios: comentariosDe(r),
        }))
        .sort((a, b) => a.promedio - b.promedio),
    };

    const marcas = [...new Set(data.map(d => d.marca))];
    const reportePorMarca = marcas
      .map(marca => {
        const rs = data.filter(d => d.marca === marca);
        return {
          marca,
          keyUser: rs[0]?.keyUser || '',
          respuestas: rs.length,
          promedioSatisfaccion: avg(rs.map(r => r.satisfaccion)),
          promedioTiempo: avg(rs.map(r => r.tiempo)),
          promedioCalidad: avg(rs.map(r => r.calidad)),
          promedioCapacitacion: avg(rs.map(r => r.capacitacion)),
          promedioGeneral: avg(rs.map(r => r.promedio)),
          comentarios: rs.flatMap(comentariosDe),
        };
      })
      .sort((a, b) => b.promedioGeneral - a.promedioGeneral);

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
      generadoEn: new Date().toISOString(),
      resumenGeneral,
      puntosDeDolor,
      reportePorMarca,
    }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
};
