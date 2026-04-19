export const ca = {
  appName: "L'Àpat Fidel",
  restaurantName: "L'Àpat del Prat",
  tagline: "Arrossos i cuina mediterrània",

  // Navegación
  nav: {
    home: "Inici",
    dashboard: "El meu compte",
    rewards: "Premis",
    roulette: "Ruleta mensual",
    news: "Notícies",
    scan: "Escanejar QR",
    login: "Iniciar sessió",
    register: "Registrar-se",
    logout: "Tancar sessió",
    admin: "Administració",
  },

  // Scan QR
  scan: {
    title: "Escaneja el teu tiquet",
    subtitle: "Apunta la càmera al QR del tiquet per sumar punts",
    instructionsTitle: "Com fer-ho",
    instructionsBody: "Col·loca el QR dins del quadre. Es llegirà automàticament.",
    torchOn: "Encendre llanterna",
    torchOff: "Apagar llanterna",
    manualTitle: "O introdueix el codi manualment",
    manualPlaceholder: "Ex: 7K2Q9P",
    manualHint: "El codi és a sota del QR del tiquet.",
    tryAgain: "Tornar a intentar",
    errorPermission: "No s'ha concedit permís per a la càmera. Comprova els permisos del navegador i torna-ho a provar.",
    errorCamera: "No s'ha pogut obrir la càmera d'aquest dispositiu.",
    errorInvalidQr: "Aquest QR no és vàlid per a L'Àpat Fidel.",
    errorInvalidCode: "El codi introduït no és vàlid.",
  },

  // Inicio
  home: {
    heroTitle: "Benvingut al nostre club de fidelitat",
    heroSubtitle: "Acumula punts cada vegada que vinguis a menjar i aconsegueix premis exclusius",
    ctaRegister: "Registrar-me gratis",
    ctaLogin: "Ja tinc compte",
    howItWorks: "Com funciona",
    step1Title: "Registra't gratis",
    step1Desc: "En menys d'un minut tens el teu compte",
    step2Title: "Acumula punts",
    step2Desc: "Escaneja el QR del teu tiquet i suma punts automàticament",
    step3Title: "Gaudeix de premis",
    step3Desc: "Bescanvia els teus punts per premis exclusius",
  },

  // Registro
  register: {
    title: "Crea el teu compte",
    subtitle: "Gratuït i en menys d'un minut",
    nombre: "Nom",
    apellidos: "Cognoms",
    telefono: "Telèfon",
    email: "Correu electrònic",
    password: "Contrasenya",
    passwordMin: "Mínim 6 caràcters",
    terms: "Accepto els termes i condicions",
    promotions: "Accepto rebre promocions i novetats de L'Àpat del Prat per correu electrònic",
    submit: "Crear compte",
    already: "Ja tens compte?",
    loginHere: "Inicia sessió aquí",
    success: "Compte creat! Revisa el teu correu per confirmar.",
    errorTerms: "Has d'acceptar els termes i condicions",
  },

  // Login
  login: {
    title: "Inicia sessió",
    subtitle: "Accedeix al teu compte de fidelitat",
    email: "Correu electrònic",
    password: "Contrasenya",
    submit: "Entrar",
    forgotPassword: "Has oblidat la contrasenya?",
    noAccount: "Encara no tens compte?",
    registerHere: "Registra't aquí",
  },

  // Dashboard
  dashboard: {
    welcome: "Hola",
    yourPoints: "Els teus punts",
    points: "punts",
    pointsEarned: "punts guanyats",
    menuCard: "Targeta de menús",
    menuCardDesc: "Acumula 250 punts de menús i el següent és gratis",
    viewRewards: "Veure premis disponibles",
    viewHistory: "Historial",
    monthlyRoulette: "Ruleta mensual",
    spinNow: "Girar ara",
    alreadySpun: "Ja has girat aquest mes",
    recentActivity: "Activitat recent",
    noActivity: "Encara no tens activitat",
    pointsEquivalent: "equivalen a",
  },

  // QR
  qr: {
    title: "Tens punts esperant-te!",
    subtitleGuest: "Registra't gratis en menys d'un minut i els punts quedaran guardats al teu compte",
    subtitleLoggedIn: "Reclama els teus punts ara",
    claim: "Reclamar {points} punts",
    claimAndRegister: "Registrar-me i reclamar punts",
    alreadyAccount: "Ja tinc compte",
    success: "Has guanyat {points} punts! El teu total és {total} punts.",
    scanWithCamera: "Escaneja aquest QR amb la càmera del teu mòbil",
    pointsWorth: "Val per {points} punts",
    validUntil: "Vàlid fins a",
    thanks: "Gràcies!",
    errorUsed: "Aquest QR ja ha estat utilitzat",
    errorExpired: "Aquest QR ha caducat",
    errorNotFound: "QR no trobat",
    pointsWaiting: "Tens {points} punts esperant-te",
    closeToReward: "T'apropes a: {reward}",
  },

  // Premios
  rewards: {
    title: "Premis disponibles",
    subtitle: "Bescanvia els teus punts per aquests premis",
    yourPoints: "Els teus punts",
    pointsNeeded: "punts necessaris",
    redeem: "Bescanviar",
    notEnough: "Et falten {points} punts",
    confirmRedeem: "Confirmar bescanvi?",
    confirmText: "Aquesta acció no es pot desfer. S'utilitzaran {points} punts.",
    cancel: "Cancel·lar",
    confirm: "Confirmar",
    redeemSuccess: "Bescanvi realitzat!",
    showCode: "Mostra aquest codi al restaurant",
    myCodes: "Els meus codis pendents",
    noCodes: "Cap codi pendent",
    validated: "Validat",
    pending: "Pendent",
  },

  // Ruleta
  roulette: {
    title: "Ruleta mensual",
    subtitle: "Gira una vegada al mes i emporta't un premi segur",
    spin: "GIRAR",
    spinning: "Girant...",
    youWon: "Has guanyat!",
    points: "punts",
    nextSpin: "Propera ruleta",
    alreadySpun: "Ja has girat aquest mes. Torna el mes vinent!",
    freeCode: "Codi per bescanviar al restaurant",
  },

  // Noticias
  news: {
    title: "Notícies i promocions",
    subtitle: "Les últimes novetats de L'Àpat del Prat",
    noNews: "Encara no hi ha notícies publicades",
  },

  // Admin
  admin: {
    title: "Panell d'administració",
    generateQr: "Generar QR",
    clients: "Clients",
    redemptions: "Bescanvis",
    news: "Notícies",
    newsletter: "Butlletí",
    stats: "Estadístiques",
    qrHistory: "Historial QR",

    // QR Generator
    qrAmount: "Import consumició (€)",
    qrIsMenu: "És un menú del dia",
    qrGenerate: "Generar QR",
    qrPoints: "Punts assignats",
    qrPrint: "Imprimir tiquet",
    qrDownload: "Descarregar",
    qrScanInstructions: "Escaneja aquest QR amb la càmera del mòbil",
    qrValidFor: "Val per",

    // Clientes
    searchClient: "Cercar client...",
    totalClients: "Total clients",
    noClients: "No s'han trobat clients",

    // Canjes
    pendingRedemptions: "Bescanvis pendents",
    code: "Codi",
    client: "Client",
    reward: "Premi",
    date: "Data",
    validate: "Validar",
    reject: "Rebutjar",

    // Stats
    statsTotalClients: "Clients registrats",
    statsPointsIssued: "Punts emesos",
    statsRedemptions: "Bescanvis realitzats",
    statsQrGenerated: "QR generats",
  },

  install: {
    title: "Instal·la L'Àpat Fidel a la pantalla d'inici",
    subtitle: "Obre l'app més ràpid i rep avisos de promocions. Ocupa molt poc espai.",
    cta: "Instal·lar app",
    later: "Més tard",
    iosTitle: "Com instal·lar-la a l'iPhone",
    iosStep1: "Toca el botó Compartir a la barra de Safari",
    iosStep2: "Desplaça i tria 'Afegeix a pantalla d'inici'",
    iosStep3: "Toca 'Afegir' i llest! Trobaràs la icona a la teva pantalla.",
    iosGotIt: "Entesos",
  },

  common: {
    save: "Desar",
    cancel: "Cancel·lar",
    delete: "Eliminar",
    edit: "Editar",
    loading: "Carregant...",
    back: "Tornar",
    error: "S'ha produït un error",
    success: "Fet!",
    required: "Obligatori",
    optional: "Opcional",
  },
};

export type Translations = typeof ca;
