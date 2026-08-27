export default function FinanzasResumen() {
  return (
    <div className="fz-intro">
      <div className="fz-intro-eyebrow">Resumen</div>
      <h1 className="fz-intro-title">Todavía no hay nada que resumir.</h1>
      <p className="fz-intro-text">
        Finanzas es un libro aparte: los ingresos y gastos se cargan a mano acá, y con eso
        el sistema arma el resumen del mes. Nada se toma automáticamente de los pedidos.
        Falta conectar la base de datos para poder empezar a cargar.
      </p>

      <div className="fz-steps">
        <div className="fz-step">
          <div className="fz-step-num">1</div>
          <div>
            <div className="fz-step-title">Movimientos</div>
            <div className="fz-step-desc">
              Cargar ingresos y gastos con fecha, monto, moneda y categoría.
            </div>
          </div>
        </div>
        <div className="fz-step">
          <div className="fz-step-num">2</div>
          <div>
            <div className="fz-step-title">Tasas de cambio</div>
            <div className="fz-step-desc">
              La tasa a dólar de cada fecha. Cada movimiento se convierte con la tasa
              vigente el día que ocurrió, así los meses cerrados no se reescriben cuando
              cambia el Bs.
            </div>
          </div>
        </div>
        <div className="fz-step">
          <div className="fz-step-num">3</div>
          <div>
            <div className="fz-step-title">Resumen mensual</div>
            <div className="fz-step-desc">
              Ingresos, gastos y ganancia del mes en curso — consolidado en dólares y con
              el desglose por moneda al lado — comparado contra el mes anterior.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
