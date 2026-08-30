import Link from 'next/link'
import './terminos.css'

export const metadata = {
  title: 'Términos y Condiciones — LyteApp',
  description: 'Términos y condiciones de uso de la plataforma LyteApp.',
}

export default function TerminosPage() {
  return (
    <div className="tc-page">
      <div className="tc-card">
        <Link href="/" className="tc-logo">
          <span className="tc-logo-text">Lyte<span>app</span></span>
        </Link>

        <h1 className="tc-title">Términos y Condiciones</h1>
        <p className="tc-updated">Última actualización: 30 de agosto de 2026</p>

        <p>
          Estos Términos y Condiciones (los &quot;Términos&quot;) rigen el acceso y uso de la plataforma LyteApp
          (el &quot;Servicio&quot;), operada por LyteApp (&quot;nosotros&quot;, &quot;LyteApp&quot;). Al crear una cuenta
          aceptas estos Términos en su totalidad. Si no estás de acuerdo, no debes registrarte ni usar el Servicio.
        </p>

        <h2>1. Descripción del servicio</h2>
        <p>
          LyteApp es una plataforma que permite a negocios crear una tienda en línea, gestionar productos,
          recibir pedidos, procesar información de clientes y coordinar la entrega o retiro de pedidos.
          LyteApp actúa como proveedor de la herramienta tecnológica; el negocio que crea una cuenta
          (el &quot;Usuario&quot; o &quot;la tienda&quot;) es el único responsable de su propio negocio, sus productos,
          sus precios, sus políticas de venta y su relación con sus propios clientes finales.
        </p>

        <h2>2. Registro de cuenta</h2>
        <p>
          Para usar el Servicio debes crear una cuenta proporcionando información veraz, exacta y actualizada.
          Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad que ocurra bajo
          tu cuenta. Debes notificarnos de inmediato ante cualquier uso no autorizado de tu cuenta.
        </p>

        <h2>3. Responsabilidad sobre la información y los datos</h2>
        <p>
          Al usar LyteApp, el Usuario podrá recopilar y almacenar en la plataforma información propia (productos,
          precios, imágenes, textos) e información de terceros, incluyendo datos personales de sus propios
          clientes finales (nombre, cédula, teléfono, dirección, ubicación, comprobantes de pago y notas de pedido).
        </p>
        <p>
          El Usuario declara y garantiza que:
        </p>
        <ul>
          <li>Tiene el derecho legítimo de recopilar, almacenar y usar toda la información que introduce en la plataforma, incluyendo la de sus propios clientes.</li>
          <li>Ha obtenido, cuando corresponda, el consentimiento necesario de sus clientes para recopilar y procesar sus datos personales.</li>
          <li>Usará esa información únicamente para fines legítimos relacionados con la operación de su negocio.</li>
          <li>Es el único responsable frente a sus clientes, autoridades o terceros por el tratamiento que le dé a esa información.</li>
        </ul>
        <p>
          LyteApp actúa únicamente como proveedor de la infraestructura técnica que aloja esta información y no
          verifica, valida ni se hace responsable por la exactitud, licitud o el uso que el Usuario le dé a los
          datos que introduce o recopila a través de la plataforma.
        </p>

        <h2>4. Usos prohibidos</h2>
        <p>Está prohibido usar LyteApp para:</p>
        <ul>
          <li>Vender productos o servicios ilegales, o que infrinjan derechos de terceros.</li>
          <li>Cometer fraude, suplantar identidad, o engañar a clientes o a otros usuarios.</li>
          <li>Recopilar datos personales sin base legal o sin la debida transparencia hacia el titular de los datos.</li>
          <li>Intentar vulnerar la seguridad de la plataforma o acceder a datos de otras tiendas sin autorización.</li>
          <li>Enviar comunicaciones no solicitadas (spam) a través de las funciones del Servicio.</li>
        </ul>
        <p>
          LyteApp se reserva el derecho de suspender o cancelar, sin previo aviso, cualquier cuenta que incumpla
          estas condiciones.
        </p>

        <h2>5. Planes y pagos</h2>
        <p>
          LyteApp puede ofrecer planes gratuitos y de pago con distintas características. Los precios, ciclos de
          cobro y condiciones de cada plan se muestran en la plataforma al momento de la contratación y pueden
          cambiar previa notificación razonable a los usuarios de planes pagos.
        </p>

        <h2>6. Propiedad intelectual</h2>
        <p>
          La marca LyteApp, su diseño, su código y su tecnología son propiedad de LyteApp. El Usuario conserva
          la propiedad de su propio contenido (nombre de tienda, productos, imágenes, textos) que sube a la
          plataforma, y otorga a LyteApp una licencia limitada para almacenar y mostrar ese contenido con el único
          fin de operar el Servicio.
        </p>

        <h2>7. Disponibilidad del servicio</h2>
        <p>
          LyteApp se presta &quot;tal cual&quot; y &quot;según disponibilidad&quot;, sin garantías de ningún tipo, expresas o
          implícitas, sobre su disponibilidad ininterrumpida, ausencia de errores, o idoneidad para un propósito
          particular. Podemos modificar, suspender o discontinuar funciones del Servicio en cualquier momento.
        </p>

        <h2>8. Limitación de responsabilidad</h2>
        <p>
          En la máxima medida permitida por la ley aplicable, LyteApp no será responsable ante el Usuario ni ante
          terceros por daños indirectos, incidentales, especiales, consecuentes o lucro cesante derivados del uso
          o la imposibilidad de uso del Servicio, incluyendo — sin limitarse a — disputas entre el Usuario y sus
          propios clientes, pérdida de datos, pérdida de ventas, o el contenido que el Usuario o sus clientes
          introduzcan en la plataforma. La responsabilidad total de LyteApp frente al Usuario, en caso de existir,
          no excederá el monto pagado por el Usuario a LyteApp en los tres (3) meses anteriores al reclamo.
        </p>

        <h2>9. Indemnización</h2>
        <p>
          El Usuario acepta indemnizar y mantener indemne a LyteApp, sus fundadores, empleados y colaboradores,
          frente a cualquier reclamo, demanda, pérdida, daño o gasto (incluyendo honorarios legales razonables)
          que surja de: (a) el uso que el Usuario haga del Servicio; (b) la información o los datos que el Usuario
          introduzca o recopile a través de la plataforma, incluyendo datos de sus propios clientes; (c) el
          incumplimiento de estos Términos; o (d) la violación de cualquier ley o derecho de un tercero por parte
          del Usuario.
        </p>

        <h2>10. Terminación</h2>
        <p>
          El Usuario puede dejar de usar el Servicio y solicitar el cierre de su cuenta en cualquier momento.
          LyteApp puede suspender o cancelar una cuenta que incumpla estos Términos, notificando al Usuario cuando
          sea razonablemente posible.
        </p>

        <h2>11. Modificaciones a estos Términos</h2>
        <p>
          Podemos actualizar estos Términos ocasionalmente. Los cambios entran en vigor al publicarse en esta
          página. El uso continuado del Servicio después de una actualización constituye la aceptación de los
          nuevos Términos.
        </p>

        <h2>12. Ley aplicable</h2>
        <p>
          Estos Términos se rigen por las leyes de la República Bolivariana de Venezuela, sin perjuicio de las
          normas de protección al consumidor u otras normas de orden público que puedan resultar aplicables en la
          jurisdicción del Usuario.
        </p>

        <h2>13. Contacto</h2>
        <p>
          Para preguntas sobre estos Términos, puedes escribirnos a través de los canales de contacto publicados
          en <a href="https://lyte-app.com">lyte-app.com</a>.
        </p>

        <Link href="/registro" className="tc-back">← Volver al registro</Link>
      </div>
    </div>
  )
}
