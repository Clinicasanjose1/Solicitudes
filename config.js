/*
 * CONFIGURACIÓN DE LA APP — es el único archivo que hay que editar.
 * Reemplace los valores entre comillas siguiendo la guía de instalación.
 */
self.APP_CONFIG = {
  // Nombre que se muestra arriba en la app
  NOMBRE_APP: 'Solicitudes CSJ',
  NOMBRE_CLINICA: 'Clínica San José de Cúcuta',

  // Paso 3 de la guía: URL de la aplicación web de Apps Script (termina en /exec)
  API_URL: https://script.google.com/macros/s/AKfycbybh4320Zxf4Jsrls31LZj_VjolEwm8i7U1XXZt09xTEBKDCaJ9ou6qhzYZ9CdG8Dnv/exec

  // Paso 4 de la guía: configuración de la app web de Firebase
  FIREBASE: {
    apiKey: "AIzaSyBRBlopJBQ9tiK6MMWgphopJG_aZrGqXRs",
    authDomain: "solicitudes-csj.firebaseapp.com",
    projectId: "solicitudes-csj",
    storageBucket: "solicitudes-csj.firebasestorage.app",
    messagingSenderId: "669555080099",
    appId: "1:669555080099:web:286c11978e8be6961f7816",
  },

  // Paso 4 de la guía: clave pública de notificaciones web (Web Push, "par de claves")
  FIREBASE_VAPID_KEY: BBLLGBPN-pzTmm5KAWGBbn9nEQ8UkwXEKa9vs3GfLXRntQ8Lg7XtI2aOhTZp6Q4y_Z6NH8ckSXnRucaGc0GCWGs
};
